import type { Message } from "@aws-sdk/client-sqs"

export type SqsOptions = {
  accessId?: string,
  secretKey?: string,
  region?: string,
}

export type SqsMessage = Message
