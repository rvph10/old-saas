import { applyDecorators, SetMetadata } from '@nestjs/common';

export function Monitor(options: { name: string; threshold?: number }) {
  return applyDecorators(SetMetadata('monitor', options));
}
