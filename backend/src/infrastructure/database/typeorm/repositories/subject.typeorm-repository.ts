import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ISubjectRepository, ListSubjectsFilter, SubjectStats } from '../../../../domain/subject/repositories/subject.repository.interface';
import { Subject, SubjectStatus } from '../../../../domain/subject/entities/subject.entity';
import { SubjectOrmEntity } from '../orm-entities/subject.orm-entity';

@Injectable()
export class SubjectTypeOrmRepository implements ISubjectRepository {
  constructor(
    @InjectRepository(SubjectOrmEntity)
    private readonly repo: Repository<SubjectOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private toEntity(orm: SubjectOrmEntity): Subject {
    const subject = new Subject();
    subject.id = orm.id;
    subject.code = orm.code;
    subject.name = orm.name;
    subject.description = orm.description;
    subject.status = orm.status as SubjectStatus;
    subject.createdBy = orm.createdBy;
    subject.createdAt = orm.createdAt;
    subject.updatedAt = orm.updatedAt;
    if (orm.lecturer) {
      subject.lecturer = {
        id: orm.lecturer.id,
        fullName: orm.lecturer.fullName,
        email: orm.lecturer.email,
      };
    }
    return subject;
  }

  async findById(id: string): Promise<Subject | null> {
    const orm = await this.repo.findOne({
      where: { id },
      relations: ['lecturer'],
    });
    return orm ? this.toEntity(orm) : null;
  }

  async findByCode(code: string): Promise<Subject | null> {
    const orm = await this.repo.findOne({ where: { code } });
    return orm ? this.toEntity(orm) : null;
  }

  async findAll(filter: ListSubjectsFilter): Promise<{ items: Subject[]; total: number }> {
    const qb = this.repo.createQueryBuilder('s')
      .leftJoinAndSelect('s.lecturer', 'lecturer');

    if (filter.status) {
      qb.andWhere('s.status = :status', { status: filter.status });
    }
    if (filter.search) {
      qb.andWhere('(s.name ILIKE :search OR s.code ILIKE :search)', {
        search: `%${filter.search}%`,
      });
    }
    if (filter.lecturerId) {
      qb.andWhere('s.lecturerId = :lecturerId', { lecturerId: filter.lecturerId });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .getMany();

    let enrolledIds = new Set<string>();
    if (filter.studentId && items.length > 0) {
      const rows = await this.dataSource.query(
        `SELECT subject_id FROM subject_enrollments
         WHERE student_id = $1 AND subject_id = ANY($2)`,
        [filter.studentId, items.map((i) => i.id)],
      );
      enrolledIds = new Set(rows.map((r: { subject_id: string }) => r.subject_id));
    }

    return {
      items: items.map((o) => {
        const subject = this.toEntity(o);
        if (filter.studentId) subject.isEnrolled = enrolledIds.has(o.id);
        return subject;
      }),
      total,
    };
  }

  async create(data: Partial<Subject>): Promise<Subject> {
    const orm = this.repo.create({
      code: data.code,
      name: data.name,
      description: data.description,
      status: data.status ?? SubjectStatus.ACTIVE,
      createdBy: data.createdBy,
    });
    const saved = await this.repo.save(orm);
    return this.toEntity(saved);
  }

  async update(id: string, data: Partial<Subject>): Promise<Subject> {
    const updateData: Partial<SubjectOrmEntity> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    await this.repo.update(id, updateData);
    return this.findById(id) as Promise<Subject>;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async assignLecturer(subjectId: string, lecturerId: string, _assignedBy: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE subjects SET lecturer_id = $2 WHERE id = $1`,
      [subjectId, lecturerId],
    );
  }

  async removeLecturer(subjectId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE subjects SET lecturer_id = NULL WHERE id = $1`,
      [subjectId],
    );
  }

  async isLecturerAssigned(subjectId: string, lecturerId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT 1 FROM subjects WHERE id = $1 AND lecturer_id = $2`,
      [subjectId, lecturerId],
    );
    return result.length > 0;
  }

  async enrollStudent(subjectId: string, studentId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO subject_enrollments (subject_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [subjectId, studentId],
    );
  }

  async unenrollStudent(subjectId: string, studentId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM subject_enrollments WHERE subject_id = $1 AND student_id = $2`,
      [subjectId, studentId],
    );
  }

  async isStudentEnrolled(subjectId: string, studentId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT 1 FROM subject_enrollments WHERE subject_id = $1 AND student_id = $2`,
      [subjectId, studentId],
    );
    return result.length > 0;
  }

  async listStudents(subjectId: string): Promise<{ id: string; fullName: string; email: string; enrolledAt: Date }[]> {
    return this.dataSource.query(
      `SELECT u.id, u.full_name AS "fullName", u.email, se.enrolled_at AS "enrolledAt"
       FROM subject_enrollments se JOIN users u ON u.id = se.student_id
       WHERE se.subject_id = $1 ORDER BY u.full_name ASC`,
      [subjectId],
    );
  }

  async getSubjectStats(subjectId: string): Promise<SubjectStats> {
    const [overviewRow] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM subject_enrollments WHERE subject_id = $1)::int AS "studentCount",
         (SELECT COUNT(*) FROM documents WHERE subject_id = $1)::int AS "documentCount",
         (SELECT COUNT(*) FROM documents WHERE subject_id = $1 AND status = 'ready')::int AS "documentsReady",
         (SELECT COUNT(*) FROM exams WHERE subject_id = $1)::int AS "examCount",
         (SELECT COUNT(*) FROM flashcard_sets WHERE subject_id = $1)::int AS "flashcardSetCount",
         (SELECT COUNT(*) FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id
            WHERE e.subject_id = $1 AND ea.status = 'completed')::int AS "totalAttempts",
         (SELECT AVG(ea.score) FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id
            WHERE e.subject_id = $1 AND ea.status = 'completed') AS "avgScore"`,
      [subjectId],
    );

    const students = await this.dataSource.query(
      `SELECT u.id, u.full_name AS "fullName", u.email,
         COUNT(ea.id) FILTER (WHERE ea.status = 'completed')::int AS "examAttempts",
         AVG(ea.score) FILTER (WHERE ea.status = 'completed') AS "avgScore",
         MAX(COALESCE(ea.completed_at, ea.started_at)) AS "lastActiveAt"
       FROM subject_enrollments se
       JOIN users u ON u.id = se.student_id
       LEFT JOIN exams e ON e.subject_id = se.subject_id AND e.created_by = u.id
       LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.user_id = u.id
       WHERE se.subject_id = $1
       GROUP BY u.id, u.full_name, u.email
       ORDER BY u.full_name ASC`,
      [subjectId],
    );

    return {
      overview: {
        studentCount: overviewRow.studentCount,
        documentCount: overviewRow.documentCount,
        documentsReady: overviewRow.documentsReady,
        examCount: overviewRow.examCount,
        flashcardSetCount: overviewRow.flashcardSetCount,
        totalAttempts: overviewRow.totalAttempts,
        avgScore: overviewRow.avgScore === null ? null : Number(overviewRow.avgScore),
      },
      students: students.map((s: SubjectStats['students'][number]) => ({
        ...s,
        avgScore: s.avgScore === null ? null : Number(s.avgScore),
      })),
    };
  }
}
