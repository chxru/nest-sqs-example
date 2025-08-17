import { SetMetadata } from "@nestjs/common";

export const SQS_CONSUMER = Symbol.for("SQS_CONSUMER")

export const SqsConsumer = (name: string) => SetMetadata(SQS_CONSUMER, {name})
