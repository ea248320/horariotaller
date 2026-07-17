export type BusinessType = 'preuniversitario' | 'taller' | 'academia' | 'personalizado';

export interface Organization {
  id: number;
  name: string;
  email: string;
  businessType: BusinessType;
  courseLabel: string;
  studentLabel: string;
  brandColor: string;
  feesEnabled: boolean;
  plan: string;
  subscriptionActive: boolean;
  trialEndsAt: string;
  createdAt: string;
}

export interface Teacher {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
}

export interface CourseBlock {
  id: number;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface Course {
  id: number;
  name: string;
  teacherId: number | null;
  teacherName: string | null;
  room: string | null;
  capacity: number;
  semester: string | null; // '1' | '2' | 'anual' | null
  enrolledCount: number;
  waitlistCount: number;
  blocks: CourseBlock[];
}

export interface CalendarBlock {
  id: number;
  weekday: number;
  startTime: string;
  endTime: string;
  courseId: number;
  courseName: string;
  room: string | null;
  semester: string | null;
  teacherName: string | null;
}

export interface StudentEnrollment {
  enrollmentId: number;
  courseId: number;
  courseName: string;
}

export interface Student {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  enrollments: StudentEnrollment[];
}

export interface PaymentRecord {
  studentId: number;
  name: string;
  phone: string | null;
  status: 'pagado' | 'pendiente';
  paidAt: string | null;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface WaitlistEntry {
  id: number;
  courseId: number;
  studentId: number;
  studentName: string;
  courseName: string;
  notifiedAt: string | null;
  createdAt: string;
}

// ─── Módulos portados de Emilia ───

export interface TaskItem {
  id: number;
  taskId: number;
  text: string;
  completed: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo: string;
  deadline: string;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  status: 'PENDIENTE' | 'EN CURSO' | 'COMPLETADA';
  createdAt: string;
  items: TaskItem[];
}

export interface Note {
  id: number;
  autor: string;
  titulo: string;
  contenido: string;
  color: 'amarillo' | 'rosa' | 'verde' | 'celeste';
  pinned: boolean;
  createdAt: string;
}

export interface Change {
  id: number;
  studentName: string;
  subject: string;
  teacherBefore: string;
  teacherAfter: string;
  leavesClass: string;
  entersClass: string;
  changeType: string;
  changeReason: string;
  transferDate: string;
  createdAt: string;
}

export interface WorkshopStudent {
  id: number;
  studentId: number;
  studentName: string;
}

export interface Workshop {
  id: number;
  name: string;
  teacherId: number | null;
  teacherName: string | null;
  room: string | null;
  workshopDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  students: WorkshopStudent[];
}

export interface Counselor {
  id: number;
  name: string;
  title: string;
  active: boolean;
}

export interface Cita {
  id: number;
  counselorId: number;
  counselorName: string;
  studentName: string;
  agendadoPor: string;
  fecha: string;
  horaInicio: string;
  motivo: string;
  estadoConfirma: 'pendiente' | 'confirmada' | 'no_confirma';
  estadoAsiste: 'pendiente' | 'asiste' | 'no_asiste';
  notaRapida: string;
}

export interface Plan {
  id: string;
  name: string;
  priceClp: number;
  maxStudents: number | null;
  features: string[];
}

export interface BillingStatus {
  plan: Plan;
  subscriptionActive: boolean;
  trialEndsAt: string;
  trialDaysLeft: number;
  trialExpired: boolean;
  studentCount: number;
  studentLimit: number | null;
  flowConfigured: boolean;
}
