import { pgTable, text, serial, integer, timestamp, primaryKey, foreignKey } from "drizzle-orm/pg-core";

export const scheduleClassesTable = pgTable("schedule_classes", {
  classCode: text("class_code").notNull(),
  horario: text("horario").notNull().default("TEMUCO"),
  day: text("day").notNull(),
  time: text("time").notNull(),
  sede: text("sede").notNull(),
  sala: integer("sala").notNull(),
  teacher: text("teacher").notNull(),
  course: text("course").notNull(),
  semester: text("semester").notNull().default("PRIMER"),
  schoolYear: integer("school_year").notNull().default(2026),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.classCode, table.semester, table.horario] }),
}));

export const scheduleStudentsTable = pgTable("schedule_students", {
  id: serial("id").primaryKey(),
  classCode: text("class_code").notNull(),
  classSemester: text("class_semester").notNull().default("PRIMER"),
  classHorario: text("class_horario").notNull().default("TEMUCO"),
  studentName: text("student_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  classFk: foreignKey({
    columns: [table.classCode, table.classSemester, table.classHorario],
    foreignColumns: [scheduleClassesTable.classCode, scheduleClassesTable.semester, scheduleClassesTable.horario],
  }).onDelete("cascade"),
}));

export const scheduleHorariosTable = pgTable("schedule_horarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  emoji: text("emoji").notNull().default("🏢"),
  gradient: text("gradient").notNull().default("from-violet-500 to-purple-600"),
  accentColor: text("accent_color").notNull().default("violet"),
  sedesJson: text("sedes_json").notNull().default("[]"),
  isSystem: integer("is_system").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(99),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scheduleTransfersTable = pgTable("schedule_transfers", {
  id: serial("id").primaryKey(),
  horarioId: text("horario_id").notNull(),
  studentName: text("student_name").notNull().default(""),
  teacherBefore: text("teacher_before").notNull().default(""),
  teacherAfter: text("teacher_after").notNull().default(""),
  sede: text("sede").notNull().default(""),
  subject: text("subject").notNull().default(""),
  leavesClass: text("leaves_class").notNull().default(""),
  entersClass: text("enters_class").notNull().default(""),
  transferDate: text("transfer_date").notNull().default(""),
  changeType: text("change_type").notNull().default("CAMBIO HORARIO"),
  changeReason: text("change_reason").notNull().default("NINGUNO"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("secretaria"),
  horarioId: text("horario_id").notNull(),
  color: text("color").notNull().default("violet"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  horarioId: text("horario_id").notNull(),
  assignedTo: text("assigned_to").notNull().default(""),
  deadline: text("deadline").notNull().default(""),
  priority: text("priority").notNull().default("MEDIA"),
  status: text("status").notNull().default("PENDIENTE"),
  createdBy: text("created_by").notNull().default("Admin"),
  isPersonal: integer("is_personal").notNull().default(0),
  personalOwner: text("personal_owner").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taskItemsTable = pgTable("task_items", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  completed: integer("completed").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workshopsTable = pgTable("workshops", {
  id: serial("id").primaryKey(),
  horarioId: text("horario_id").notNull(),
  sede: text("sede").notNull(),
  teacher: text("teacher").notNull(),
  name: text("name").notNull().default(""),
  workshopDate: text("workshop_date").notNull().default(""),
  workshopTime: text("workshop_time").notNull().default(""),
  maxStudents: integer("max_students").notNull().default(8),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workshopStudentsTable = pgTable("workshop_students", {
  id: serial("id").primaryKey(),
  workshopId: integer("workshop_id").notNull().references(() => workshopsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notasTable = pgTable("notas", {
  id: serial("id").primaryKey(),
  horarioId: text("horario_id").notNull(),
  autor: text("autor").notNull().default(""),
  titulo: text("titulo").notNull().default(""),
  contenido: text("contenido").notNull().default(""),
  color: text("color").notNull().default("amarillo"),
  pinned: integer("pinned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Workshop = typeof workshopsTable.$inferSelect;
export type WorkshopStudent = typeof workshopStudentsTable.$inferSelect;
export type Nota = typeof notasTable.$inferSelect;
export type ScheduleClass = typeof scheduleClassesTable.$inferSelect;
export type ScheduleStudent = typeof scheduleStudentsTable.$inferSelect;
export type ScheduleHorario = typeof scheduleHorariosTable.$inferSelect;
export type ScheduleTransfer = typeof scheduleTransfersTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type TaskItem = typeof taskItemsTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;

