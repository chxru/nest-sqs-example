# AWS SQS with NestJS

> Code is not the cleanest, this was kind of a playground code I worked before working on the actual work. Spent too much time on this hence thought to publish it to save someone else's time. Code you thats worth copy pasting is in `lib/sqs`

## How it use

1. Register the module and mention the queue urls you need to listen in `app.module.ts`
```ts
@Module({
  imports: [
    SqsModule.register([
      "https://sqs.us-east-1.amazonaws.com/123456789/queue"
      ]
    )
  ]
})
```

2. To consume use `SqsConsumer(queue_url)` decorator
```ts
@Injectable
export class SomeService {
  constructor(private readonly sqsService: SqsService) {}

  @SqsConsumer("https://sqs.us-east-1.amazonaws.com/123456789/queue")
  async consume(message: SqsMessage) {
    const success: string[] = []

    for (const message of messages) {
      // should return the successful message receipt handlers to delete them from the queue
      message.ReceiptHandle && success.push(message.ReceiptHandle)
    }

    return success;
  }
}
```

3. To produce a message use `produce` function
