import * as v from 'valibot';

import { HlcSchema } from '../hlc/schema';
import type { StateVector } from './types';

export const StateVectorSchema = v.record(
  v.pipe(v.string(), v.minLength(1)),
  HlcSchema,
) satisfies v.GenericSchema<StateVector>;
