import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { SendMoneyPayload } from './interface/send-money-payload.interface';

@Injectable()
export class EasypaisaClient {
  private readonly apiUrl =
    process.env.EASYPAISA_API ?? 'https://sandbox.easypaisa.com.pk/tx';

  constructor(private readonly http: HttpService) {}

  async sendMoney(payload: SendMoneyPayload): Promise<string> {
    const body: any = {
      amount: payload.amount,
      reference: payload.reference,
      ...(payload.msisdn ? { msisdn: payload.msisdn } : { cnic: payload.cnic }),
    };

    const { data } = await this.http
      .post(`${this.apiUrl}/send-money`, body)
      .toPromise();

    if (data.status !== 'SUCCESS')
      throw new Error(`Easypaisa failed: ${data.message ?? 'unknown'}`);

    return data.transactionId as string;
  }
}
