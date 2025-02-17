// @ts-nocheck
import { type Fiber, getType } from 'bippy';
// import type { ComponentType } from 'preact';
import { ReactScanInternals } from '~core/index';
import type { AggregatedRender } from '~web/utils/outline';
import type { AggregatedChange, Render } from './instrumentation';

function descending(a: number, b: number): number {
  return b - a;
}

interface ComponentData {
  name: string;
  forget: boolean;
  time: number;
}

function getComponentGroupNames(group: ComponentData[]): string {
  let result = group[0].name;

  const len = group.length;
  const max = Math.min(4, len);

  for (let i = 1; i < max; i++) {
    result += `, ${group[i].name}`;
  }

  return result;
}

function getComponentGroupTotalTime(group: ComponentData[]): number {
  let result = group[0].time;

  for (let i = 1, len = group.length; i < len; i++) {
    result += group[i].time;
  }

  return result;
}

function componentGroupHasForget(group: ComponentData[]): boolean {
  for (let i = 0, len = group.length; i < len; i++) {
    if (group[i].forget) {
      return true;
    }
  }
  return false;
}

export const getLabelText = (
  groupedAggregatedRenders: Array<AggregatedRender>,
) => {
  let labelText = '';

  const componentsByCount = new Map<
    number,
    Array<{ name: string; forget: boolean; time: number }>
  >();

  for (const aggregatedRender of groupedAggregatedRenders) {
    const { forget, time, aggregatedCount, name } = aggregatedRender;
    if (!componentsByCount.has(aggregatedCount)) {
      componentsByCount.set(aggregatedCount, []);
    }
    const components = componentsByCount.get(aggregatedCount);
    if (components) {
      components.push({ name, forget, time: time ?? 0 });
    }
  }

  const sortedCounts = Array.from(componentsByCount.keys()).sort(descending);

  const parts: Array<string> = [];
  let cumulativeTime = 0;
  for (const count of sortedCounts) {
    const componentGroup = componentsByCount.get(count);
    if (!componentGroup) continue;

    let text = getComponentGroupNames(componentGroup);
    const totalTime = getComponentGroupTotalTime(componentGroup);
    const hasForget = componentGroupHasForget(componentGroup);

    cumulativeTime += totalTime;

    if (componentGroup.length > 4) {
      text += '…';
    }

    if (count > 1) {
      text += ` × ${count}`;
    }

    if (hasForget) {
      text = `✨${text}`;
    }

    parts.push(text);
  }

  labelText = parts.join(', ');

  if (!labelText.length) return null;

  if (labelText.length > 40) {
    labelText = `${labelText.slice(0, 40)}…`;
  }

  if (cumulativeTime >= 0.01) {
    labelText += ` (${Number(cumulativeTime.toFixed(2))}ms)`;
  }

  return labelText;
};

export const updateFiberRenderData = (fiber: Fiber, renders: Array<Render>) => {
  ReactScanInternals.options.value.onRender?.(fiber, renders);
  const type = getType(fiber.type) || fiber.type;
  if (type && typeof type === 'function' && typeof type === 'object') {
    const renderData = (type.renderData || {
      count: 0,
      time: 0,
      renders: [],
    }) as RenderData;
    const firstRender = renders[0];
    renderData.count += firstRender.count;
    renderData.time += firstRender.time ?? 0;
    renderData.renders.push(firstRender);
    type.renderData = renderData;
  }
};

export interface RenderData {
  count: number;
  time: number;
  renders: Array<Render>;
  displayName: string | null;
  type: unknown;
  changes?: Array<RenderChange>;
}

export function isEqual(a: unknown, b: unknown): boolean {
  // biome-ignore lint/suspicious/noSelfCompare: reliable way to detect NaN values in JavaScript
  return a === b || (a !== a && b !== b);
}
