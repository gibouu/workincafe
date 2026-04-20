'use client';

import * as Phosphor from '@phosphor-icons/react';
import type { IconProps, IconWeight } from '@phosphor-icons/react';
import type { ComponentType } from 'react';

export type PhosphorIconName = keyof typeof Phosphor;

export function Icon({
  name,
  weight = 'regular',
  size = 22,
  className,
  ...rest
}: {
  name: PhosphorIconName;
  weight?: IconWeight;
  size?: number;
  className?: string;
} & Omit<IconProps, 'weight' | 'size'>) {
  const Component = Phosphor[name] as unknown as ComponentType<IconProps>;
  return <Component weight={weight} size={size} className={className} {...rest} />;
}
