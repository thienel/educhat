import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { ISubjectRepository } from '../../../domain/subject/repositories/subject.repository.interface';
import { TOKENS } from '../../../shared/constants/tokens';
import { User } from '../../../domain/user/entities/user.entity';

@Injectable()
export class ListSubjectStudentsUseCase {
  constructor(
    @Inject(TOKENS.SUBJECT_REPO) private readonly subjectRepo: ISubjectRepository,
  ) {}

  async execute(subjectId: string, requestingUser?: User) {
    if (requestingUser && requestingUser.roleName === 'lecturer') {
      const isAssigned = await this.subjectRepo.isLecturerAssigned(subjectId, requestingUser.id);
      if (!isAssigned) throw new ForbiddenException('You are not assigned to this subject');
    }
    return this.subjectRepo.listStudents(subjectId);
  }
}
