import type { RoomPlanItem } from '../types';
import type { BorderSamplePoint } from './roomPlanGeometry';
import { clampRoomPlanItem } from './roomPlan';

type Point2D = {
  x: number;
  y: number;
};

export type WindowSnapResult = {
  item: RoomPlanItem;
  snapIndex: number;
  distance: number;
};

const normalizeAngle = (angle: number): number => {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
};

const squaredDistance = (left: Point2D, right: Point2D): number => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
};

const getWindowCenter = (item: RoomPlanItem): Point2D => ({
  x: item.x + item.width / 2,
  y: item.y + item.height / 2,
});

const withWindowContainer = (item: RoomPlanItem): RoomPlanItem => (
  item.container === 'wrapper' ? item : { ...item, container: 'wrapper' }
);

const chooseInwardNormal = (
  anchor: Point2D,
  tangentAngle: number,
  planWidth: number,
  planHeight: number
): Point2D => {
  const radians = (tangentAngle * Math.PI) / 180;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const normalA = { x: -tangent.y, y: tangent.x };
  const normalB = { x: tangent.y, y: -tangent.x };
  const planCenter = { x: planWidth / 2, y: planHeight / 2 };

  const candidateA = { x: anchor.x + normalA.x * 10, y: anchor.y + normalA.y * 10 };
  const candidateB = { x: anchor.x + normalB.x * 10, y: anchor.y + normalB.y * 10 };

  return squaredDistance(candidateA, planCenter) <= squaredDistance(candidateB, planCenter) ? normalA : normalB;
};

export const findNearestBorderPoint = (
  position: Point2D,
  borderPoints: BorderSamplePoint[],
  preferredIndex: number | null = null,
  stickinessPx = 4
): { point: BorderSamplePoint; index: number; distance: number } | null => {
  if (!borderPoints.length) return null;

  let nearestIndex = 0;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let index = 0; index < borderPoints.length; index += 1) {
    const candidateDistanceSquared = squaredDistance(position, borderPoints[index]);
    if (candidateDistanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = candidateDistanceSquared;
      nearestIndex = index;
    }
  }

  if (preferredIndex != null && preferredIndex >= 0 && preferredIndex < borderPoints.length) {
    const preferredDistanceSquared = squaredDistance(position, borderPoints[preferredIndex]);
    const nearestDistance = Math.sqrt(nearestDistanceSquared);
    const preferredDistance = Math.sqrt(preferredDistanceSquared);

    if (preferredDistance <= nearestDistance + stickinessPx) {
      return {
        point: borderPoints[preferredIndex],
        index: preferredIndex,
        distance: preferredDistance,
      };
    }
  }

  return {
    point: borderPoints[nearestIndex],
    index: nearestIndex,
    distance: Math.sqrt(nearestDistanceSquared),
  };
};

export const snapWindowItemToBorder = (
  item: RoomPlanItem,
  borderPoints: BorderSamplePoint[],
  planWidth: number,
  planHeight: number,
  anchor: Point2D,
  preferredIndex: number | null = null
): WindowSnapResult => {
  const nearest = findNearestBorderPoint(anchor, borderPoints, preferredIndex);
  if (!nearest) {
    return {
      item: clampRoomPlanItem(withWindowContainer(item), planWidth, planHeight),
      snapIndex: -1,
      distance: Number.POSITIVE_INFINITY,
    };
  }

  const normal = chooseInwardNormal(nearest.point, nearest.point.angle, planWidth, planHeight);
  const offset = item.height / 2;
  const center = {
    x: nearest.point.x + normal.x * offset,
    y: nearest.point.y + normal.y * offset,
  };

  const snapped: RoomPlanItem = {
    ...item,
    container: 'wrapper',
    rotation: normalizeAngle(nearest.point.angle),
    x: center.x - item.width / 2,
    y: center.y - item.height / 2,
  };

  return {
    item: snapped,
    snapIndex: nearest.index,
    distance: nearest.distance,
  };
};

export const snapWindowUsingCurrentPosition = (
  item: RoomPlanItem,
  borderPoints: BorderSamplePoint[],
  planWidth: number,
  planHeight: number,
  preferredIndex: number | null = null
): WindowSnapResult => snapWindowItemToBorder(
  item,
  borderPoints,
  planWidth,
  planHeight,
  getWindowCenter(item),
  preferredIndex
);

