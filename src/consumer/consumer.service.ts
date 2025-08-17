import { Injectable } from '@nestjs/common';
import { CreateConsumerDto } from './dto/create-consumer.dto';
import { UpdateConsumerDto } from './dto/update-consumer.dto';
import { SqsService } from 'libs/sqs/src';
import { SqsConsumer } from 'libs/sqs/src/sqs.decorator';

@Injectable()
export class ConsumerService {
  constructor(private readonly sqsService: SqsService) {}
  
  create(createConsumerDto: CreateConsumerDto) {
    return 'This action adds a new consumer';
  }

  findAll() {
    this.sqsService.notifyAll();
    return `This action returns all consumer`;
  }

  findOne(id: number) {
    return `This action returns a #${id} consumer`;
  }

  update(id: number, updateConsumerDto: UpdateConsumerDto) {
    return `This action updates a #${id} consumer`;
  }

  remove(id: number) {
    return `This action removes a #${id} consumer`;
  }

  @SqsConsumer("debug sqs function")
  consumerFunction() {
    console.log("consumed")
  }
}
