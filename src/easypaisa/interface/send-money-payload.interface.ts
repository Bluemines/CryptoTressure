export interface SendMoneyPayload {
  //03xxxxxxxxx (phone)
  msisdn?: string;
  // 42101-1234567-8 (CNIC)
  cnic?: string;
  // amount in *string* as required by Easypaisa
  amount: string;
  // our internal reference
  reference: string;
}
