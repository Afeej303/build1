import { Module } from '@nestjs/common';
import { HospitalController } from './hospital.controller.js';

@Module({ controllers: [HospitalController] })
export class HospitalModule {}
