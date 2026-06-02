import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Resolver('Business')
@UseGuards(JwtAuthGuard)
export class BusinessResolver {
  constructor(private readonly businessService: BusinessService) {}

  @Query(() => [String])
  async businesses(@Args('ownerId') ownerId: string) {
    return this.businessService.findAll(ownerId);
  }

  @Query(() => String)
  async business(@Args('id') id: string) {
    return this.businessService.findOne(id);
  }

  @Mutation(() => String)
  async createBusiness(
    @Args('ownerId') ownerId: string,
    @Args('input') createBusinessDto: CreateBusinessDto,
  ) {
    return this.businessService.create(ownerId, createBusinessDto);
  }

  @Mutation(() => String)
  async updateBusiness(
    @Args('id') id: string,
    @Args('input') updateBusinessDto: UpdateBusinessDto,
  ) {
    return this.businessService.update(id, updateBusinessDto);
  }

  @Mutation(() => String)
  async removeBusiness(@Args('id') id: string) {
    return this.businessService.remove(id);
  }
}
