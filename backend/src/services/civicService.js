const CATEGORY_LABELS = Object.freeze({
  POTHOLES: "Potholes",
  GARBAGE: "Garbage",
  STREETLIGHTS: "Streetlights",
  DRAINAGE: "Drainage",
  WATER_SUPPLY: "Water supply",
});

const DUPLICATE_RADIUS_METERS = 250;

function distanceMeters(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function caseWithCoordinates(record) {
  return record.case?.location?.coordinates
    ? {
        complaint: record,
        coordinates: record.case.location.coordinates,
      }
    : null;
}

export function getAuthoritySuggestion() {
  return {
    suggestion: null,
    verificationStatus: "NOT_AVAILABLE",
    message: "An authority finder is not configured. No authority has been identified or assigned.",
  };
}

export function groupPotentialDuplicates(complaints) {
  const located = complaints.map(caseWithCoordinates).filter(Boolean);
  const remaining = new Set(located.map((item) => item.complaint._id.toString()));
  const groups = [];
  const byId = new Map(located.map((item) => [item.complaint._id.toString(), item]));

  for (const item of located) {
    const itemId = item.complaint._id.toString();
    if (!remaining.has(itemId)) continue;

    const groupIds = [itemId];
    remaining.delete(itemId);

    for (const candidateId of [...remaining]) {
      const candidate = byId.get(candidateId);
      if (
        candidate.complaint.category === item.complaint.category &&
        distanceMeters(item.coordinates, candidate.coordinates) <= DUPLICATE_RADIUS_METERS
      ) {
        groupIds.push(candidateId);
        remaining.delete(candidateId);
      }
    }

    if (groupIds.length > 1) {
      groups.push({
        category: item.complaint.category,
        categoryLabel: CATEGORY_LABELS[item.complaint.category],
        reviewRequired: true,
        detectionMethod: "CATEGORY_AND_DISTANCE_HEURISTIC",
        complaints: groupIds.map((id) => {
          const complaint = byId.get(id).complaint;
          return {
            caseId: complaint.case._id,
            title: complaint.case.title,
            status: complaint.case.status,
            createdAt: complaint.case.createdAt,
          };
        }),
      });
    }
  }

  return groups;
}
