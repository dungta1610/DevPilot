import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Opts a route out of the success-envelope transform — used for SSE streams,
 * whose payloads must remain raw `text/event-stream` frames.
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
