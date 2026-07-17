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
