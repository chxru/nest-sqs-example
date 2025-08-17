import { SetMetadata } from "@nestjs/common";

export const SQS_CONSUMER = Symbol.for("SQS_CONSUMER")

export const SqsConsumer = (url: string) => SetMetadata(SQS_CONSUMER, {url})
