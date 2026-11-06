const DEFAULT_PRIORITY_WEIGHTS = Object.freeze({
  express: 1800,
  nearSla: 1200,
  failedOnce: 900,
  appointment: 600
});
const DEFAULT_PICKUP_PRIORITY_ORDER = Object.freeze(['fifo', 'deadline', 'distance']);
const MAX_STOPS = 60;
const MAX_TWO_OPT_ITERATIONS = 80;
const MAX_OPTIMIZATION_MS = 50;
const MATRIX_CACHE_TTL_MS = 30_000;
const matrixCache = new Map();

function validCoordinate(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
}

function haversineMeters(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(second.lat - first.lat);
  const deltaLng = radians(second.lng - first.lng);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat))
      * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function distanceToPolylineMeters(point, coordinates) {
  const latitude = Number(point.lat) * Math.PI / 180;
  const scaleX = Math.cos(latitude) * 111_320;
  const scaleY = 110_574;
  const target = { x: Number(point.lng) * scaleX, y: Number(point.lat) * scaleY };
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const first = { x: Number(coordinates[index][0]) * scaleX, y: Number(coordinates[index][1]) * scaleY };
    const second = { x: Number(coordinates[index + 1][0]) * scaleX, y: Number(coordinates[index + 1][1]) * scaleY };
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared ? Math.max(0, Math.min(1,
      ((target.x - first.x) * dx + (target.y - first.y) * dy) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(target.x - (first.x + ratio * dx), target.y - (first.y + ratio * dy)));
  }
  return Number.isFinite(nearest) ? nearest : Number.POSITIVE_INFINITY;
}

async function getRouteDeviationMeters({ point, segmentStart, segmentEnd, osrmUrl, fetchImpl = globalThis.fetch }) {
  const validPoint = validCoordinate(point);
  const start = validCoordinate(segmentStart);
  const end = validCoordinate(segmentEnd);
  if (!validPoint || !start || !end) return Number.POSITIVE_INFINITY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const response = await fetchImpl(
      `${(osrmUrl || process.env.OSRM_URL || 'http://localhost:5001').replace(/\/+$/, '')}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error(`OSRM route HTTP ${response.status}`);
    const result = await response.json();
    const geometry = result.routes?.[0]?.geometry?.coordinates;
    if (result.code !== 'Ok' || !Array.isArray(geometry) || geometry.length < 2) throw new Error('OSRM route geometry is invalid.');
    return distanceToPolylineMeters(validPoint, geometry);
  } catch {
    return distanceToPolylineMeters(validPoint, [[start.lng, start.lat], [end.lng, end.lat]]);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedAddress(stop, mode) {
  const address = String(stop.address || '').trim().toLocaleLowerCase('vi')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (mode === 'pickup' && stop.shop_id) return `shop:${stop.shop_id}`;
  const point = validCoordinate(stop);
  const coordinates = point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : 'no-coordinate';
  return address ? `address:${address}` : `coordinates:${coordinates}`;
}

function groupStops(stops, mode) {
  const grouped = new Map();
  for (const stop of stops) {
    const key = normalizedAddress(stop, mode);
    const current = grouped.get(key);
    if (current) {
      current.orderIds.push(Number(stop.order_id ?? stop.id));
      current.orders.push(stop);
      current.prioritySeconds = Math.max(current.prioritySeconds, Number(stop.prioritySeconds || 0));
      if (stop.appointmentAt && (!current.appointmentAt || stop.appointmentAt < current.appointmentAt)) {
        current.appointmentAt = stop.appointmentAt;
      }
      continue;
    }
    grouped.set(key, {
      ...stop,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      orderIds: [Number(stop.order_id ?? stop.id)],
      orders: [stop],
      prioritySeconds: Number(stop.prioritySeconds || 0),
      appointmentAt: stop.appointmentAt || null
    });
  }
  return [...grouped.values()];
}

function cacheKey(points) {
  return points.map(({ lat, lng }) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(';');
}

function createFallbackMatrix(points) {
  return {
    distances: points.map((from) => points.map((to) => Math.round(haversineMeters(from, to)))),
    durations: points.map((from) => points.map((to) => Math.round(haversineMeters(from, to) / 8.33)))
  };
}

async function getRouteMatrix(points, osrmUrl, fetchImpl) {
  const key = cacheKey(points);
  const cached = matrixCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.matrix, isEstimated: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const coordinates = points.map(({ lat, lng }) => `${lng},${lat}`).join(';');
    const response = await fetchImpl(
      `${osrmUrl.replace(/\/+$/, '')}/table/v1/driving/${coordinates}?annotations=duration,distance`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error(`OSRM table HTTP ${response.status}`);
    const result = await response.json();
    if (result.code !== 'Ok' || !Array.isArray(result.durations) || !Array.isArray(result.distances)) {
      throw new Error('OSRM returned an invalid route matrix.');
    }
    const matrix = { durations: result.durations, distances: result.distances };
    matrixCache.set(key, { matrix, expiresAt: Date.now() + MATRIX_CACHE_TTL_MS });
    return { ...matrix, isEstimated: false };
  } finally {
    clearTimeout(timeout);
  }
}

function routeCost(sequence, matrix, startIndex, endIndex) {
  let distance = 0;
  let duration = 0;
  let priorityPlacement = 0;
  let previous = startIndex;
  sequence.forEach((stopIndex, position) => {
    const matrixIndex = stopIndex + 1;
    distance += Number(matrix.distances[previous]?.[matrixIndex] ?? 0);
    duration += Number(matrix.durations[previous]?.[matrixIndex] ?? 0);
    priorityPlacement += position * Number(sequence.stops[stopIndex]?.prioritySeconds || 0);
    previous = matrixIndex;
  });
  if (endIndex !== null && endIndex !== undefined) {
    distance += Number(matrix.distances[previous]?.[endIndex] ?? 0);
    duration += Number(matrix.durations[previous]?.[endIndex] ?? 0);
  }
  return duration + priorityPlacement / Math.max(1, sequence.length);
}

function optimizeOrder(stops, matrix, hasEndPoint) {
  const startIndex = 0;
  const stopOffset = 1;
  const endIndex = hasEndPoint ? stops.length + 1 : null;
  const remaining = new Set(stops.map((_, index) => index));
  const order = [];
  let currentIndex = startIndex;
  while (remaining.size) {
    let chosen = null;
    let chosenCost = Number.POSITIVE_INFINITY;
    for (const stopIndex of remaining) {
      const matrixIndex = stopIndex + stopOffset;
      const travel = Number(matrix.durations[currentIndex]?.[matrixIndex] ?? Number.MAX_SAFE_INTEGER);
      const priority = Number(stops[stopIndex].prioritySeconds || 0);
      const cost = travel - priority;
      if (cost < chosenCost) {
        chosen = stopIndex;
        chosenCost = cost;
      }
    }
    order.push(chosen);
    remaining.delete(chosen);
    currentIndex = chosen + stopOffset;
  }

  order.stops = stops;
  const deadline = Date.now() + MAX_OPTIMIZATION_MS;
  let improved = true;
  let iterations = 0;
  while (improved && iterations < MAX_TWO_OPT_ITERATIONS && Date.now() < deadline) {
    improved = false;
    iterations += 1;
    for (let first = 0; first < order.length - 1 && Date.now() < deadline; first += 1) {
      for (let last = first + 1; last < order.length; last += 1) {
        const candidate = [...order.slice(0, first), ...order.slice(first, last + 1).reverse(), ...order.slice(last + 1)];
        candidate.stops = stops;
        if (routeCost(candidate, matrix, startIndex, endIndex) < routeCost(order, matrix, startIndex, endIndex) - 0.01) {
          order.splice(0, order.length, ...candidate);
          order.stops = stops;
          improved = true;
        }
      }
    }
  }
  return { order, startIndex, endIndex, stopOffset };
}

function parsePickupPriorityOrder(value = DEFAULT_PICKUP_PRIORITY_ORDER) {
  const priorityOrder = Array.isArray(value)
    ? value.map((criterion) => String(criterion).trim().toLowerCase())
    : String(value).split(',').map((criterion) => criterion.trim().toLowerCase());
  const allowed = new Set(DEFAULT_PICKUP_PRIORITY_ORDER);
  if (priorityOrder.length !== allowed.size
    || new Set(priorityOrder).size !== allowed.size
    || priorityOrder.some((criterion) => !allowed.has(criterion))) {
    throw new Error('PICKUP_PRIORITY_ORDER must contain fifo, deadline, and distance exactly once.');
  }
  return priorityOrder;
}

function timestamp(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function pickupDeadline(order, createdAt, pickupSlaMinutes) {
  const candidates = [
    { value: order.pickup_deadline_at, label: 'hạn lấy' },
    { value: order.pickup_appointment_at, label: 'giờ hẹn' }
  ].map(({ value, label }) => ({ value: timestamp(value), label }));
  if (createdAt !== null && pickupSlaMinutes > 0) {
    candidates.push({
      value: createdAt + pickupSlaMinutes * 60_000,
      label: 'hạn SLA'
    });
  }
  return candidates
    .filter((candidate) => candidate.value !== null)
    .sort((first, second) => first.value - second.value)[0] || null;
}

function formatPickupTime(value) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function pickupRank(stop, { nowMs, bucketMs, maxWaitMs, pickupSlaMinutes }) {
  const oldestOrder = stop.orders.reduce((oldest, order) => {
    const orderCreatedAt = timestamp(order.created_at) ?? nowMs;
    const oldestCreatedAt = timestamp(oldest.created_at) ?? nowMs;
    return orderCreatedAt < oldestCreatedAt ? order : oldest;
  }, stop.orders[0] || stop);
  const createdAt = timestamp(oldestOrder.created_at);
  const effectiveCreatedAt = createdAt ?? nowMs;
  const bucketStart = Math.floor(effectiveCreatedAt / bucketMs) * bucketMs;
  const deadline = pickupDeadline(oldestOrder, createdAt, pickupSlaMinutes);
  const waitedTooLong = nowMs - effectiveCreatedAt >= maxWaitMs;
  const express = String(oldestOrder.service_type || '').toLowerCase() === 'express';
  const reasonParts = [];
  if (express) reasonParts.push('Hỏa tốc');
  if (waitedTooLong) reasonParts.push(`Chờ quá ngưỡng ${Math.round(maxWaitMs / 60_000)} phút`);
  const bucketEnd = bucketStart + bucketMs;
  reasonParts.push(
    `Khung ${formatPickupTime(bucketStart)}-${formatPickupTime(bucketEnd)}`
  );
  if (deadline) reasonParts.push(`${deadline.label} ${formatPickupTime(deadline.value)}`);
  stop.pickupRankReasonParts = reasonParts;
  return {
    tier: express ? 0 : waitedTooLong ? 1 : 2,
    bucketStart,
    deadlineAt: deadline?.value ?? Number.POSITIVE_INFINITY
  };
}

function comparePickupRank(first, second, priorityOrder) {
  if (first.pickupRank.tier !== second.pickupRank.tier) {
    return first.pickupRank.tier - second.pickupRank.tier;
  }
  for (const criterion of priorityOrder) {
    if (criterion === 'fifo' && first.pickupRank.bucketStart !== second.pickupRank.bucketStart) {
      return first.pickupRank.bucketStart - second.pickupRank.bucketStart;
    }
    if (criterion === 'deadline' && first.pickupRank.deadlineAt !== second.pickupRank.deadlineAt) {
      return first.pickupRank.deadlineAt - second.pickupRank.deadlineAt;
    }
    if (criterion === 'distance'
      && first.pickupRank.distanceRank !== undefined
      && first.pickupRank.distanceRank !== second.pickupRank.distanceRank) {
      return first.pickupRank.distanceRank - second.pickupRank.distanceRank;
    }
  }
  return 0;
}

function routeDistanceCost(order, matrix, endIndex) {
  let total = 0;
  let previousIndex = 0;
  for (const stopIndex of order) {
    const matrixIndex = stopIndex + 1;
    total += Number(matrix.distances[previousIndex]?.[matrixIndex] ?? Number.MAX_SAFE_INTEGER);
    previousIndex = matrixIndex;
  }
  if (endIndex !== null) {
    total += Number(matrix.distances[previousIndex]?.[endIndex] ?? Number.MAX_SAFE_INTEGER);
  }
  return total;
}

function optimizePickupOrder(stops, matrix, hasEndPoint, priorityOrder, pickupSettings) {
  const rankedStops = stops.map((stop, originalIndex) => ({
    ...stop,
    originalIndex,
    pickupRank: pickupRank(stop, pickupSettings)
  }));
  const distanceCriterionIndex = priorityOrder.indexOf('distance');
  if (distanceCriterionIndex < priorityOrder.length - 1) {
    const distanceRemaining = new Set(rankedStops.map((stop) => stop.originalIndex));
    let currentMatrixIndex = 0;
    let distanceRank = 0;
    while (distanceRemaining.size) {
      let chosen = null;
      let chosenDistance = Number.POSITIVE_INFINITY;
      for (const stopIndex of distanceRemaining) {
        const distance = Number(matrix.distances[currentMatrixIndex]?.[stopIndex + 1] ?? Number.MAX_SAFE_INTEGER);
        if (distance < chosenDistance) {
          chosen = stopIndex;
          chosenDistance = distance;
        }
      }
      rankedStops[chosen].pickupRank.distanceRank = distanceRank;
      distanceRank += 1;
      distanceRemaining.delete(chosen);
      currentMatrixIndex = chosen + 1;
    }
  }
  rankedStops.sort((first, second) => comparePickupRank(first, second, priorityOrder));
  const rankedStopsByIndex = [...rankedStops].sort((first, second) => first.originalIndex - second.originalIndex);

  const endIndex = hasEndPoint ? stops.length + 1 : null;
  const order = [];
  let currentMatrixIndex = 0;
  let tierStart = 0;
  while (tierStart < rankedStops.length) {
    let tierEnd = tierStart + 1;
    while (tierEnd < rankedStops.length
      && comparePickupRank(rankedStops[tierStart], rankedStops[tierEnd], priorityOrder) === 0) {
      tierEnd += 1;
    }
    const tierIndices = rankedStops.slice(tierStart, tierEnd)
      .map((stop) => stop.originalIndex);
    const remaining = new Set(tierIndices);
    const tierOrder = [];
    while (remaining.size) {
      let chosen = null;
      let chosenDistance = Number.POSITIVE_INFINITY;
      for (const stopIndex of remaining) {
        const distance = Number(matrix.distances[currentMatrixIndex]?.[stopIndex + 1] ?? Number.MAX_SAFE_INTEGER);
        if (distance < chosenDistance) {
          chosen = stopIndex;
          chosenDistance = distance;
        }
      }
      tierOrder.push(chosen);
      remaining.delete(chosen);
      currentMatrixIndex = chosen + 1;
    }
    order.push(...tierOrder);
    tierStart = tierEnd;
  }

  const deadline = Date.now() + MAX_OPTIMIZATION_MS;
  let improved = true;
  let iterations = 0;
  while (improved && iterations < MAX_TWO_OPT_ITERATIONS && Date.now() < deadline) {
    improved = false;
    iterations += 1;
    const baselineCost = routeDistanceCost(order, matrix, endIndex);
    for (let first = 0; first < order.length - 1 && Date.now() < deadline; first += 1) {
      for (let last = first + 1; last < order.length; last += 1) {
        const firstStop = rankedStopsByIndex[order[first]];
        if (order.slice(first, last + 1).some((index) => (
          comparePickupRank(firstStop, rankedStopsByIndex[index], priorityOrder) !== 0
        ))) continue;
        const candidate = [
          ...order.slice(0, first),
          ...order.slice(first, last + 1).reverse(),
          ...order.slice(last + 1)
        ];
        if (routeDistanceCost(candidate, matrix, endIndex) < baselineCost - 0.01) {
          order.splice(0, order.length, ...candidate);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  return { order, endIndex, stopOffset: 1 };
}

async function optimizeRoute({
  driverId,
  mode,
  stops,
  startPoint,
  endPoint = null,
  priorityWeights = DEFAULT_PRIORITY_WEIGHTS,
  pickupFifoBucketMinutes = 30,
  pickupMaxWaitMinutes = 120,
  pickupSlaMinutes = 120,
  pickupPriorityOrder = DEFAULT_PICKUP_PRIORITY_ORDER,
  osrmUrl = process.env.OSRM_URL || 'http://localhost:5001',
  fetchImpl = globalThis.fetch,
  now = new Date()
}) {
  if (!Number.isSafeInteger(Number(driverId)) || Number(driverId) <= 0) throw new Error('driverId is invalid.');
  if (!['pickup', 'delivery'].includes(mode)) throw new Error('mode must be pickup or delivery.');
  if (!Array.isArray(stops) || stops.length > MAX_STOPS) throw new Error(`Route supports at most ${MAX_STOPS} stops.`);
  const start = validCoordinate(startPoint);
  if (!start) throw new Error('A valid startPoint is required.');
  const end = endPoint ? validCoordinate(endPoint) : null;
  if (endPoint && !end) throw new Error('endPoint must have valid coordinates.');

  const groups = groupStops(stops.filter((stop) => (
    stop.status !== 'completed'
    && !stop.completed
    && !(mode === 'pickup' && stop.order_status === 'picked_up')
    && validCoordinate(stop)
  )), mode);
  const points = [start, ...groups.map(({ lat, lng }) => ({ lat, lng })), ...(end ? [end] : [])];
  let matrix;
  let isEstimated = false;
  try {
    matrix = await getRouteMatrix(points, osrmUrl, fetchImpl);
  } catch {
    matrix = createFallbackMatrix(points);
    isEstimated = true;
  }
  let order, startIndex, endIndex, stopOffset;
  const priorityOrder = mode === 'pickup' ? parsePickupPriorityOrder(pickupPriorityOrder) : null;
  if (mode === 'pickup') {
    const bucketMinutes = Number(pickupFifoBucketMinutes);
    const maxWaitMinutes = Number(pickupMaxWaitMinutes);
    const slaMinutes = Number(pickupSlaMinutes);
    if (![bucketMinutes, maxWaitMinutes, slaMinutes].every(Number.isFinite)
      || bucketMinutes <= 0 || maxWaitMinutes < 0 || slaMinutes < 0) {
      throw new Error('Pickup priority settings must contain valid non-negative minute values.');
    }
    const pickupSettings = {
      nowMs: new Date(now).getTime(),
      bucketMs: bucketMinutes * 60_000,
      maxWaitMs: maxWaitMinutes * 60_000,
      pickupSlaMinutes: slaMinutes
    };
    const rankedGroups = groups.map((group) => ({
      ...group,
      pickupSettings
    }));
    ({ order, startIndex, endIndex, stopOffset } = {
      ...optimizePickupOrder(rankedGroups, matrix, Boolean(end), priorityOrder, pickupSettings),
      startIndex: 0
    });
    for (const group of rankedGroups) {
      pickupRank(group, pickupSettings);
    }
    groups.splice(0, groups.length, ...rankedGroups);
  } else {
    ({ order, startIndex, endIndex, stopOffset } = optimizeOrder(groups, matrix, Boolean(end)));
  }
  let previousMatrixIndex = startIndex;
  let elapsedSeconds = 0;
  let totalDistanceM = 0;
  const startTime = new Date(now);
  const orderedStops = order.map((groupIndex, index) => {
    const stop = groups[groupIndex];
    const matrixIndex = groupIndex + stopOffset;
    const duration = Number(matrix.durations[previousMatrixIndex]?.[matrixIndex] ?? 0);
    const distance = Number(matrix.distances[previousMatrixIndex]?.[matrixIndex] ?? 0);
    elapsedSeconds += duration;
    totalDistanceM += distance;
    let plannedEta = new Date(startTime.getTime() + elapsedSeconds * 1000);
    if (stop.appointmentAt) {
      const appointment = new Date(stop.appointmentAt);
      if (Number.isFinite(appointment.getTime()) && plannedEta < appointment) {
        plannedEta = appointment;
        elapsedSeconds = Math.ceil((appointment.getTime() - startTime.getTime()) / 1000);
      }
    }
    previousMatrixIndex = matrixIndex;
    const resultStop = { ...stop };
    const { pickupRankReasonParts } = resultStop;
    delete resultStop.pickupSettings;
    delete resultStop.pickupRank;
    delete resultStop.pickupRankReasonParts;
    return {
      ...resultStop,
      stopSequence: index + 1,
      plannedEta: plannedEta.toISOString(),
      distanceFromPreviousM: Math.round(distance),
      durationFromPreviousS: Math.round(duration),
      ...(mode === 'pickup' ? {
        rankingReason: [
          ...(pickupRankReasonParts || []),
          `cách ${(distance / 1000).toFixed(1)} km`
        ].join(', ')
      } : {})
    };
  });
  if (endIndex !== null) {
    totalDistanceM += Number(matrix.distances[previousMatrixIndex]?.[endIndex] ?? 0);
    elapsedSeconds += Number(matrix.durations[previousMatrixIndex]?.[endIndex] ?? 0);
  }
  return {
    driverId: Number(driverId),
    mode,
    stops: orderedStops,
    totalDistanceM: Math.round(totalDistanceM),
    totalDurationS: Math.round(elapsedSeconds),
    isEstimated
  };
}

async function measureOrderedRoute({
  driverId,
  mode,
  stops,
  startPoint,
  endPoint = null,
  osrmUrl = process.env.OSRM_URL || 'http://localhost:5001',
  fetchImpl = globalThis.fetch,
  now = new Date()
}) {
  if (!Array.isArray(stops) || stops.length > MAX_STOPS) throw new Error(`Route supports at most ${MAX_STOPS} stops.`);
  const start = validCoordinate(startPoint);
  if (!start) throw new Error('A valid startPoint is required.');
  const end = endPoint ? validCoordinate(endPoint) : null;
  if (endPoint && !end) throw new Error('endPoint must have valid coordinates.');
  const points = [start, ...stops.map((stop) => validCoordinate(stop)), ...(end ? [end] : [])];
  let matrix;
  let isEstimated = false;
  try {
    if (points.some((point) => !point)) throw new Error('All route stops must have valid coordinates.');
    matrix = await getRouteMatrix(points, osrmUrl, fetchImpl);
  } catch {
    matrix = createFallbackMatrix(points.map((point, index) => point || (index ? points[index - 1] : start)));
    isEstimated = true;
  }
  let elapsedSeconds = 0;
  let totalDistanceM = 0;
  let previousIndex = 0;
  const startTime = new Date(now);
  const measuredStops = stops.map((stop, index) => {
    const matrixIndex = index + 1;
    const duration = Number(matrix.durations[previousIndex]?.[matrixIndex] ?? 0);
    const distance = Number(matrix.distances[previousIndex]?.[matrixIndex] ?? 0);
    elapsedSeconds += duration;
    totalDistanceM += distance;
    let plannedEta = new Date(startTime.getTime() + elapsedSeconds * 1000);
    if (stop.appointmentAt) {
      const appointment = new Date(stop.appointmentAt);
      if (Number.isFinite(appointment.getTime()) && plannedEta < appointment) {
        plannedEta = appointment;
        elapsedSeconds = Math.ceil((appointment.getTime() - startTime.getTime()) / 1000);
      }
    }
    previousIndex = matrixIndex;
    return {
      ...stop,
      stopSequence: index + 1,
      plannedEta: plannedEta.toISOString(),
      distanceFromPreviousM: Math.round(distance),
      durationFromPreviousS: Math.round(duration)
    };
  });
  if (end) {
    const endIndex = points.length - 1;
    totalDistanceM += Number(matrix.distances[previousIndex]?.[endIndex] ?? 0);
    elapsedSeconds += Number(matrix.durations[previousIndex]?.[endIndex] ?? 0);
  }
  return {
    driverId: Number(driverId),
    mode,
    stops: measuredStops,
    totalDistanceM: Math.round(totalDistanceM),
    totalDurationS: Math.round(elapsedSeconds),
    isEstimated
  };
}

function clearRouteMatrixCache() {
  matrixCache.clear();
}

module.exports = {
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_PICKUP_PRIORITY_ORDER,
  clearRouteMatrixCache,
  distanceToPolylineMeters,
  getRouteDeviationMeters,
  groupStops,
  haversineMeters,
  measureOrderedRoute,
  optimizeRoute
};
