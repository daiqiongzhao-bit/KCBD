import { Controller, Get } from '@nestjs/common';

const APP_VERSION = 'V0.0.14';

/** 系统版本信息（公开）。 */
@Controller('meta')
export class MetaController {
  @Get('version')
  version() {
    return { version: APP_VERSION };
  }
}
