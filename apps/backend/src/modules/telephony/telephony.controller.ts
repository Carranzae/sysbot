import { Controller, Post, Body, Param, Header } from '@nestjs/common';
import { TwilioService } from './twilio.service';

@Controller('telephony')
export class TelephonyController {
  constructor(private twilioService: TwilioService) {}

  @Post('incoming-call')
  @Header('Content-Type', 'text/xml')
  async handleIncomingCall(@Body() body: any) {
    const { From, To, CallSid } = body;
    return this.twilioService.receiveCall(From, To, CallSid);
  }

  @Post('process-speech/:businessId/:callSid')
  @Header('Content-Type', 'text/xml')
  async processSpeech(
    @Param('businessId') businessId: string,
    @Param('callSid') callSid: string,
    @Body() body: any
  ) {
    const { SpeechResult } = body;
    return this.twilioService.processSpeechResult(callSid, businessId, SpeechResult);
  }

  @Post('status-callback')
  async handleStatusCallback(@Body() body: any) {
    console.log('Call status callback:', body);
    return { status: 'received' };
  }
}
