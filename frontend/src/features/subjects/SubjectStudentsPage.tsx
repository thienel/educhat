import { useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useSubjectStudents } from './queries'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SubjectStudentsPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: students = [], isLoading } = useSubjectStudents(id)

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="text-base font-medium text-zinc-50">Students</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{students.length} enrolled</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg bg-zinc-900" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students enrolled"
          description="Students will appear here once they enroll in this subject."
        />
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wide hidden md:table-cell">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors duration-150">
                  <td className="py-3 px-4 text-zinc-300">{student.fullName}</td>
                  <td className="py-3 px-4 text-zinc-500 text-xs hidden sm:table-cell">{student.email}</td>
                  <td className="py-3 px-4 text-zinc-500 text-xs hidden md:table-cell">{formatDate(student.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
