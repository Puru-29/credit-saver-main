import Case from "../models/Case.js";
import Document from "../models/Document.js";
import { generateDocumentTemplate } from "../config/documentTemplates.js";

const requiredCaseTypes = Object.freeze({
  RTI_APPLICATION: "RTI",
  FIRST_APPEAL: "RTI",
  RIGHTS_LETTER: "RIGHTS",
  CIVIC_COMPLAINT: "CIVIC",
});

function asDocumentObject(document) {
  return typeof document.toObject === "function" ? document.toObject() : { ...document };
}

export function createDocumentGenerationService({
  DocumentModel = Document,
  CaseModel = Case,
  templateGenerator = generateDocumentTemplate,
} = {}) {
  async function generateAndSave({ userId, type, input }) {
    let linkedCase;
    if (input.caseId) {
      const expectedType = requiredCaseTypes[type];
      linkedCase = await CaseModel.findOne({
        _id: input.caseId,
        user: userId,
        ...(expectedType ? { type: expectedType } : {}),
      }).select("_id type title summary details authority location");

      if (!linkedCase) {
        const error = new Error(
          expectedType
            ? `An owned ${expectedType} case is required for this document`
            : "Owned case not found",
        );
        error.statusCode = 404;
        throw error;
      }
    }

    const generated = templateGenerator(type, {
      ...input,
      ...(linkedCase
        ? {
            caseTitle: linkedCase.title,
            description: input.description || linkedCase.details || linkedCase.summary || "",
            authorityName: input.authorityName || linkedCase.authority?.name,
            authority: input.authority || linkedCase.authority,
            location: input.location || linkedCase.location,
          }
        : {}),
    });
    const document = await DocumentModel.create({
      user: userId,
      ...(linkedCase ? { case: linkedCase._id } : {}),
      title: generated.title,
      content: generated.content,
      type,
      source: "GENERATED",
      sourceLabel: "NyaySetu text template; user review required",
      verificationStatus: "UNVERIFIED",
      reviewRequired: true,
      status: "DRAFT",
      mimeType: "text/plain; charset=utf-8",
      sizeBytes: Buffer.byteLength(generated.content, "utf8"),
    });

    if (linkedCase) {
      await CaseModel.updateOne(
        { _id: linkedCase._id, user: userId },
        {
          $push: {
            timeline: {
              type: "DOCUMENT",
              title: `Document draft created: ${generated.title}`,
              occurredAt: new Date(),
            },
          },
        },
      );
    }

    return asDocumentObject(document);
  }

  return Object.freeze({ generateAndSave });
}

const documentGenerationService = createDocumentGenerationService();

export const generateAndSaveDocument = documentGenerationService.generateAndSave;
