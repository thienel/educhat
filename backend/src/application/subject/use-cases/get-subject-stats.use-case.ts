import { Injectable, Inject } from '@nestjs/common';
import { ISubjectRepository } from '../../../domain/subject/repositories/subject.repository.interface';
import { TOKENS } from '../../../shared/constants/tokens';

@Injectable()
export class GetSubjectStatsUseCase {
  constructor(
    @Inject(TOKENS.SUBJECT_REPO) private readonly subjectRepo: ISubjectRepository,
  ) {}

  async execute(subjectId: string) {
    return this.subjectRepo.getSubjectStats(subjectId);
  }
}
