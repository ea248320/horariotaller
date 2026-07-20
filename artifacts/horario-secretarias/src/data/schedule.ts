export interface ClassEntry {
  day: string;
  time: string;
  sede: string;
  sala: number;
  classCode: string;
  students: string[];
  teacher: string;
  course: string;
  horario?: string;
  semester?: string;
}

export const DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];
export const DAY_LABELS: Record<string, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
};

export const TIME_SLOTS = [
  '09.15 - 10.15',
  '10:30 - 11:30',
  '11.45 - 12.45',
  '15.30 - 16.30',
  '16.45 - 17.45',
  '18.00 - 19.00',
  '19.15 - 20.15',
];

export const SEDES = ['LAS ENCINAS', 'INES DE SUAREZ'];

export type HorarioId = string;

export interface SedeInfo {
  name: string;
  displayName: string;
  maxSalas: number;
}

export interface HorarioConfig {
  id: HorarioId;
  label: string;
  subtitle: string;
  sedes: string[];
  sedesInfo?: SedeInfo[];
  gradient: string;
  accentColor: string;
  emoji: string;
  isSystem?: boolean;
}

// La plataforma parte sin campus predefinidos: cada cliente crea los suyos
// desde Admin → Gestionar Campus. Este objeto queda vacío a propósito.
export const HORARIOS: Record<string, HorarioConfig> = {};

export const HORARIO_LIST: HorarioConfig[] = Object.values(HORARIOS);

export const COURSE_FULL_NAMES: Record<string, string> = {
  'M1':       'Matemática 1',
  'M1 INT':   'Matemática 1 Intensivo',
  'M1 CONT':  'Matemática 1 Continuación',
  'M2':       'Matemática 2',
  'M2 INT':   'Matemática 2 Intensivo',
  'MT':       'Matemática Tercer Ciclo',
  'MS':       'Matemática Superior',
  'MP':       'Matemática Preuniversitaria',
  'FIS':      'Física',
  'FIS INT':  'Física Intensivo',
  'FIS CONT': 'Física Continuación',
  'BIO':      'Biología',
  'BIO INT':  'Biología Intensivo',
  'BIO CONT': 'Biología Continuación',
  'QUI':      'Química',
  'QUI INT':  'Química Intensivo',
  'QUI CONT': 'Química Continuación',
  'LN':       'Lenguaje',
  'LN INT':   'Lenguaje Intensivo',
  'LN CONT':  'Lenguaje Continuación',
  'LT':       'Lenguaje Tercer Ciclo',
  'LS':       'Lenguaje Superior',
  'LP':       'Lenguaje Preuniversitaria',
  'HS':       'Historia',
  'HS INT':   'Historia Intensivo',
  'HIS':      'Historia',
  'HIS INT':  'Historia Intensivo',
  'CS':       'Ciencias Sociales',
};

export const TEACHER_NAMES: Record<string, string> = {
  'JR': 'JR',
  'PF': 'PF',
  'DE': 'DE',
  'AV': 'AV',
  'SF': 'SF',
  'SC': 'SC',
  'CP': 'CP',
  'CA': 'CA',
  'CC': 'CC',
  'FM': 'FM',
  'LB': 'LB',
  'LO': 'LO',
  'JV': 'JV',
  'ES': 'ES',
  'SS': 'SS',
  'KG': 'KG',
  'JO': 'JO',
};

export const COURSE_COLORS: Record<string, string> = {
  // Matemática
  'M1':       'bg-yellow-100 text-yellow-800 border-yellow-200',
  'M1 INT':   'bg-yellow-200 text-yellow-900 border-yellow-300',
  'M1 CONT':  'bg-yellow-300 text-yellow-900 border-yellow-400',
  'M2':       'bg-amber-100 text-amber-800 border-amber-200',
  'M2 INT':   'bg-amber-200 text-amber-900 border-amber-300',
  'MT':       'bg-lime-100 text-lime-800 border-lime-200',
  'MS':       'bg-amber-100 text-amber-900 border-amber-300',
  'MP':       'bg-yellow-50 text-yellow-700 border-yellow-200',
  // Lenguaje
  'LN':       'bg-red-100 text-red-800 border-red-200',
  'LN INT':   'bg-red-200 text-red-900 border-red-300',
  'LN CONT':  'bg-red-300 text-red-900 border-red-400',
  'LT':       'bg-rose-100 text-rose-800 border-rose-200',
  'LS':       'bg-rose-100 text-rose-900 border-rose-300',
  'LP':       'bg-red-50 text-red-700 border-red-200',
  // Física
  'FIS':      'bg-orange-100 text-orange-800 border-orange-200',
  'FIS INT':  'bg-orange-200 text-orange-900 border-orange-300',
  'FIS CONT': 'bg-orange-300 text-orange-900 border-orange-400',
  // Química
  'QUI':      'bg-cyan-100 text-cyan-800 border-cyan-200',
  'QUI INT':  'bg-cyan-200 text-cyan-900 border-cyan-300',
  'QUI CONT': 'bg-teal-100 text-teal-800 border-teal-200',
  // Biología
  'BIO':      'bg-green-100 text-green-800 border-green-200',
  'BIO INT':  'bg-green-200 text-green-900 border-green-300',
  'BIO CONT': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  // Historia
  'HS':       'bg-gray-100 text-gray-600 border-gray-200',
  'HS INT':   'bg-gray-200 text-gray-700 border-gray-300',
  'HIS':      'bg-gray-100 text-gray-700 border-gray-200',
  'HIS INT':  'bg-gray-200 text-gray-800 border-gray-300',
  // Otros
  'CS':       'bg-slate-100 text-slate-800 border-slate-200',
};

export const scheduleData: ClassEntry[] = [
  { day: "LUNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 LUN 10.30 JR", students: ["Agustín Llanquihuen","Consuelo Martinez","Cristobal Muñoz","Florencia Bastias","Joseph Vergara","Martina Bello"], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS INT LUN 10.30 DE", students: ["Agustina Pérez","Aileen Lagos","Barbara Peña","Isidora Pereda","Paula Canales","Antonio Xi"], teacher: "DE", course: "FIS INT" },
  { day: "LUNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 6, classCode: "BIO INT LUN 10.30 AV", students: ["Florencia Pooley","Francisca Leal","Francisca Torrejón","Maitte Jofre","María Estrada","Martina Sanchez","Rafael Briceño"], teacher: "AV", course: "BIO INT" },
  { day: "LUNES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 LUN 10.30 PF", students: ["Laura Dungan","Catalina Pritzke","Fernanda Barra","Lucas Muñoz","Josefina Ewert","Joaquin Barragan"], teacher: "PF", course: "M1" },
  { day: "LUNES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 4, classCode: "FIS INT LUN 10.30 SF", students: ["Emilia Martínez","Emilio Del","Francisca Peña","Maria Cabezas","Sofia Barnechea","Valentina Araneda","Valentina Lincolao"], teacher: "SF", course: "FIS INT" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 INT LUN 11.45 JR", students: ["Emilia Rivas","Gabriela Astorga","Javiera Ricke","Martin Schulz","Sofia Arriagada","Sofía Carrasco"], teacher: "JR", course: "M1 INT" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 3, classCode: "FIS LUN 11.45 DE", students: ["Benjamin Díaz","Cristobal Muñoz","Hi-Jue Wu","Joseph Vergara","María Araneda","Sofia Gomez","Vicente Salvatici"], teacher: "DE", course: "FIS" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 6, classCode: "BIO LUN 11.45 AV", students: ["Antonella Axtell","Antonia Herrera","Consuelo Martinez","Dilan Medina","Josefa Saba","Lucas Fehling","Matilda Hermosilla"], teacher: "AV", course: "BIO" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 INT LUN 11.45 PF", students: ["Emilia Martínez","maría sepúlveda","Sofia Barnechea","Valentina Araneda","Valentina Lincolao"], teacher: "PF", course: "M1 INT" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "INES DE SUAREZ", sala: 4, classCode: "FIS INT LUN 11.45 SF", students: ["Josefina Anabalon","Martina Sanchez"], teacher: "SF", course: "FIS INT" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 4, classCode: "BIO LUN 15.30 AV", students: [], teacher: "AV", course: "BIO" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 1, classCode: "LN LUN 15.30 SC", students: ["Cameron Herrera","Catalina Araya","Diego Heise","Emilia Díaz","Sofia Silva","Rocío Gauto"], teacher: "SC", course: "LN" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 LUN 15.30 SF", students: ["Emilia Pincheira","Florencia Reyes","Helena Paz","Jose Salas","Luciana Seguel","Martin Holtheuer"], teacher: "SF", course: "M1" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO LUN 15.30 FM", students: [], teacher: "FM", course: "BIO" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 4, classCode: "M1 LUN 15.30 JR", students: ["Ailin Benitez","Ariela Acencio","Fernanda Contreras","Juan Fuguet","Maria Dubreuil","María Caro"], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 LUN 16.45 JR", students: ["Catalina Losada","Fernanda Kiekebusch","Isabel Maturana","Jorge Olguin","Vladimir Cortes"], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 2, classCode: "HS LUN 16.45 LO", students: ["Carlos Vasquez","Domenica Vasquez","Lucas Muñoz","Maria Alvarez","Fernanda Contreras","Vicente Iñiguez"], teacher: "LO", course: "HS" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 4, classCode: "BIO LUN 16.45 AV", students: ["Loretta Rivano","Luciano Escobar","Ornella Fonseca"], teacher: "AV", course: "BIO" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 5, classCode: "FIS LUN 16.45 DE", students: ["Leonor Fabiola Alcalde Negrón","Catalina Paz Belmar Mardones","Joaquin Vicente Perez Miranda","Leonor Ignacia Quintana Aguilera","Javiera Ignacia Salvatici Castro","Emilia Tenorio Yañez","Antonella Catalina Valdes Garcia"], teacher: "DE", course: "FIS" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 6, classCode: "M1 LUN 16.45 ES", students: ["Constanza Proschle","Anastasia Gutierrez","Hans Umbach","Mia Martinez","Pia Landerretche","Vittorio Massardo"], teacher: "ES", course: "M1" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 1, classCode: "LS LUN 16.45 SC", students: ["Catalina Cornejo","Leonor Martinez","Vicente Miranda"], teacher: "SC", course: "LS" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 LUN 16.45 PF", students: ["Celeste Almendras","Benjamin Leon","Isidora Arriagada","Rodrigo Moscoso","Mateo Zavala","Vicente Paslack"], teacher: "PF", course: "M1" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO LUN 16.45 FM", students: ["Ailin Benitez","Angel Araya","Cameron Herrera","Josefina Losada","Martin Holtheuer","Martina Souto"] , teacher: "FM", course: "BIO" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 4, classCode: "MT LUN 16.45 SF", students: ["Agustina Gutierrez","Belen Jamarne","Javiera Lagos","Jose Henriquez","Nicolas Villamizar","Alberto Riquelme","Fernando Ringler","Sebastián Céspedes"], teacher: "SF", course: "MT" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 1, classCode: "MT LUN 18.00 JR", students: ["Agustin Alister","Isidora Monsalve","Isidora Buck","Juan Saez","Nicolas Jofré","Nicolas Vidal","Vicente Canteros","O: Gaspar Nisin"], teacher: "JR", course: "MT" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 2, classCode: "HS LUN 18.00 JV", students: ["Antonella Espinoza","Francisca Mendoza","Valentina Panichine"], teacher: "JV", course: "HS" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 3, classCode: "LN LUN 18.00 LB", students: ["Antonella Valdes","Emilia Huenchullan","Francisco García","Ignacio Sandoval","Julieta Coronado","Diego Vives"], teacher: "LB", course: "LN" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 4, classCode: "BIO LUN 18.00 AV", students: ["Benjamin Cid","Isidora San","Martina Valdés","Vicente Toro"], teacher: "AV", course: "BIO" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 5, classCode: "FIS LUN 18.00 DE", students: ["Emilia Victoria Gomez Silva","Catalina Isidora Gonzalez Hetz","Bastian Alfonso Henning Avendaño","Leonor Martinez"], teacher: "DE", course: "FIS" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 6, classCode: "M1 LUN 18.00 ES", students: ["Amparo Birke","Barbara Diaz","Ignacio Valenzuela","Isidora Rivas","Joaquin Perez","José Hoyuela","Matias Vera"], teacher: "ES", course: "M1" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 7, classCode: "QUI LUN 18.00 CC", students: [], teacher: "CC", course: "QUI" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 1, classCode: "LP LUN 18.00 SC", students: ["Gaston Pizarro","Matías Linconao"], teacher: "SC", course: "LP" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 2, classCode: "MS LUN 18.00 PF", students: ["Tomás Díaz","Colomba Bórquez","Emilia Muñoz","Leandro Contreras","Leonor Martinez","Matilda Vorphal","Vicente Miranda"], teacher: "PF", course: "MS" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO LUN 18.00 FM", students: ["Ariela Aedo","Diego Fuentes","Diego Moraga","Leon Chancerel","Matilda Rojo","catalina labraña","Catalina Villagran"], teacher: "FM", course: "BIO" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 4, classCode: "MS LUN 18.00 SF", students: ["Agustina Gutierrez","Belen Jamarne","Javiera Lagos","Jose Henriquez","Nicolas Villamizar"], teacher: "SF", course: "MS" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 1, classCode: "M2 LUN 19.15 JR", students: ["Agustin Saez","Antonia Herrera","Aurora Rogel","Lucas Morales","Vicente Urrutia"], teacher: "JR", course: "M2" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 2, classCode: "HS LUN 19.15 JV", students: ["Amalia Minck","Martin Sanhueza","Philippe Antoine","Renato Drake"], teacher: "JV", course: "HS" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 3, classCode: "LT LUN 19.15 LB", students: ["Catalina Tapia","Facundo Gómez","Felipe Fernández","Fernanda Caro","James Collyer","Lucas Argandoña","Antonio Conejeros"], teacher: "LB", course: "LT" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 4, classCode: "BIO LUN 19.15 AV", students: ["Catalina Covarrubias","Bastian Henning","Catalina Gonzalez","Fernanda Caro","James Collyer"], teacher: "AV", course: "BIO" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 1, classCode: "LN LUN 19.15 SC", students: ["Angel Araya","Aurora Herdener","Benjamín Hernandez","Emiliano De La Cruz","Isidora Cifuentes","Javiera Luders"], teacher: "SC", course: "LN" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 LUN 19.15 PF", students: ["Emilia Pincheira","Fernanda Sandoval","Helena Paz","Isidora San","Matias Flores","Maximo Riquelme"], teacher: "PF", course: "M1" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO LUN 19.15 SS", students: [], teacher: "SS", course: "BIO" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 4, classCode: "FIS LUN 19.15 SF", students: ["Yi-Fei Leung"], teacher: "SF", course: "FIS" },

  { day: "MARTES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 INT MAR 10.30 PF", students: ["Agustina Morales","Francisca Torrejón","Martina Sanchez","Matilde Yañez","Mia Vasconez","Vicente Caballero","Sofia Gomez"], teacher: "PF", course: "M1 INT" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS MAR 10.30 DE", students: ["Alvaro Colomera","Ignacia Hernandez","Javiera Ricke","Matilda Juarez","Miguel Muñoz"], teacher: "DE", course: "FIS" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 6, classCode: "LN MAR 10.30 SC", students: ["Laura Dungan","Francisca Peña"], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 1, classCode: "LN INT MAR 10.30 CP", students: ["Francisca Peña","Agustina Pérez","Aileen Lagos","Emilia Martínez","Emilio Del","maría sepúlveda","Valentina Araneda","Valentina Lincolao","Amanda Fernandez"], teacher: "CP", course: "LN INT" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 2, classCode: "BIO INT MAR 10.30 AV", students: ["Agustina Pérez","Aileen Lagos","Emilia Martínez","Emilio Del","maría sepúlveda","Valentina Araneda","Valentina Lincolao","Cristobal Muñoz"], teacher: "AV", course: "BIO INT" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 3, classCode: "FIS INT MAR 10.30 SF", students: ["Amanda Fernandez"], teacher: "SF", course: "FIS INT" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 4, classCode: "QUI MAR 10.30 CA", students: ["Cristobal Muñoz","Maximiliano Rodriguez","Philippe Antoine","Sergio Rebolledo","María José Godoy"], teacher: "CA", course: "QUI" },
  { day: "MARTES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 11.45 PF", students: ["Antonella Axtell","Antonia Herrera","Ignacia Hernandez","Joaquin Muñoz","Juan Herrera","Matilda Juarez"], teacher: "PF", course: "M1" },
  { day: "MARTES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 3, classCode: "FIS INT MAR 11.45 DE", students: ["Florencia Pooley","Francisca Torrejón","María Estrada","Rafael Briceño","Lucas Morales"], teacher: "DE", course: "FIS INT" },
  { day: "MARTES", time: "11.45 - 12.45", sede: "INES DE SUAREZ", sala: 1, classCode: "BIO INT MAR 11.45 AV", students: [], teacher: "AV", course: "BIO INT" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 2, classCode: "LN MAR 15.30 SC", students: ["Joseph Vergara","Sebastián Gotschlich","Agustin Ullrich","Facundo Silva"], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI MAR 15.30 CC", students: ["Emilia Tenorio","Ian Strodthoff","María Mora"], teacher: "CC", course: "QUI" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 4, classCode: "FIS MAR 15.30 DE", students: ["Benjamín Jouannet","Emilia Beltran","Fernanda Nuñez","Maite Bastias"], teacher: "DE", course: "FIS" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 2, classCode: "LT MAR 15.30 LB", students: [], teacher: "LB", course: "LT" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 16.45 PF", students: ["Agustin Ullrich","Bridgette Prado","Carlos Vasquez","Ignacio Bellolio","Jose Fuentes","Josefina Losada","Rocío Gauto"], teacher: "PF", course: "M1" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 2, classCode: "LS MAR 16.45 SC", students: ["Pablo Aburto","Martin Torres","Maximiliano Mediavilla","María Albornoz","Maria Fernandez","Martin Mendez"], teacher: "SC", course: "LS" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "QUI MAR 16.45 CC", students: ["Emilia Tenorio","Ian Strodthoff","María Mora","María Albornoz","Martin Mendez"], teacher: "CC", course: "QUI" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 4, classCode: "FIS MAR 16.45 DE", students: ["Benjamín Jouannet","Emilia Beltran","Fernanda Nuñez","Maite Bastias"], teacher: "DE", course: "FIS" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 2, classCode: "LT MAR 16.45 LB", students: [], teacher: "LB", course: "LT" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 1, classCode: "MT MAR 18.00 PF", students: ["Amalia Fuentes","Angeles Barrientos","Martín Soto","Matilda Gomez","Victoria Salas","Violeta Schiattino","Antonio Conejeros"], teacher: "PF", course: "MT" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 3, classCode: "LT MAR 18.00 SC", students: ["Agustin Alister","Isidora Monsalve","Isidora Buck","León Kehr","María Albornoz","Vicente Canteros"], teacher: "SC", course: "LT" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 1, classCode: "BIO MAR 18.00 SS", students: ["Javiera Urzua","Rocío Gauto"], teacher: "SS", course: "BIO" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 2, classCode: "BIO MAR 18.00 AV", students: [], teacher: "AV", course: "BIO" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 3, classCode: "QUI MAR 18.00 CA", students: ["Magdalena Espinosa"], teacher: "CA", course: "QUI" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 4, classCode: "M1 MAR 18.00 SF", students: ["Emiliano De","Isidora Cifuentes","Lucas Morales","Philippe Antoine","Sergio Rebolledo"], teacher: "SF", course: "M1" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 5, classCode: "HS MAR 18.00 LO", students: ["HS MAR 18.00 LO"], teacher: "LO", course: "HS" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 1, classCode: "MT MAR 19.15 PF", students: ["Fernanda Caro","Francisca Castro","Laura Zenteno","Martina Guajardo","Noelia Quiroz","Sofía Pérez","Valentina Venegas"], teacher: "PF", course: "MT" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 3, classCode: "LN MAR 19.15 SC", students: ["Agustin Saez","Bastian Henning","Cristobal Paredes","Fernanda Mella","James Collyer","Javiera Vargas","Josefina Henning","Vicente Paslack","Maite Verdugo","Florencia Jara","Vicente Paslack","Sofia Pérez"], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 5, classCode: "MT MAR 19.15 JR", students: ["Florencia Jara","Josefina Henning","Maite Verdugo","Jacobe henriquez","Tomás Recabarren"], teacher: "JR", course: "MT" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 1, classCode: "BIO MAR 19.15 SS", students: ["Rocío Gauto"], teacher: "SS", course: "BIO" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 2, classCode: "BIO MAR 19.15 AV", students: [], teacher: "AV", course: "BIO" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 3, classCode: "QUI MAR 19.15 CA", students: ["Rocio Pincheira","Lucas Morales","Maximiliano Rodriguez","Isidora Cifuentes","María José Godoy"], teacher: "CA", course: "QUI" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 4, classCode: "M1 MAR 19.15 SF", students: ["Emiliano De","Isidora Cifuentes","Lucas Morales"], teacher: "SF", course: "M1" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 5, classCode: "HS MAR 19.15 LO", students: [], teacher: "LO", course: "HS" },

  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MIE 10.30 JR", students: ["Dilan Medina","Aileen Lagos","Araneda Soto Valentina","Benjamin Díaz"], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI INT MIE 10.30 CC", students: ["Catalina Pritzke","Agustina Pérez","Amanda Muñoz"], teacher: "CC", course: "QUI INT" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 4, classCode: "LN INT MIE 10.30 SC", students: ["Agustina Morales","Alvaro Colomera","Javiera Ricke","Matilda Juarez","Miguel Muñoz"], teacher: "SC", course: "LN INT" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 5, classCode: "LN MIE 10.30 CP", students: ["Fernanda Lassalle","Barbara Peña","Amaro Godoy"], teacher: "CP", course: "LN" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 2, classCode: "QUI MIE 10.30 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 3, classCode: "FIS INT MIE 10.30 DE", students: ["Agustín Llanquihuen","Agustina Pérez"], teacher: "DE", course: "FIS INT" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 4, classCode: "M1 INT MIE 10.30 PF", students: ["Agustín Llanquihuen","Amanda Muñoz","Agustina Morales","Alvaro Colomera"], teacher: "PF", course: "M1 INT" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 INT MIE 11.45 JR", students: ["Emilia Rivas","Gabriela Astorga","Javiera Ricke","Martin Schulz","Sofia Arriagada","Sofía Carrasco"], teacher: "JR", course: "M1 INT" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 3, classCode: "QUI INT MIE 11.45 CC", students: [], teacher: "CC", course: "QUI INT" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 5, classCode: "LN INT MIE 11.45 CP", students: [], teacher: "CP", course: "LN INT" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 6, classCode: "BIO INT MIE 11.45 AV", students: ["Antonella Axtell","Antonia Herrera","Consuelo Martinez","Dilan Medina","Josefa Saba","Lucas Fehling","Matilda Hermosilla"], teacher: "AV", course: "BIO INT" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "INES DE SUAREZ", sala: 1, classCode: "QUI MIE 11.45 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "INES DE SUAREZ", sala: 2, classCode: "FIS INT MIE 11.45 DE", students: [], teacher: "DE", course: "FIS INT" },
  { day: "MIERCOLES", time: "11.45 - 12.45", sede: "INES DE SUAREZ", sala: 3, classCode: "M2 MIE 11.45 PF", students: [], teacher: "PF", course: "M2" },
  { day: "MIERCOLES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 1, classCode: "QUI MIE 15.30 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "MIERCOLES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 3, classCode: "M1 MIE 15.30 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 4, classCode: "LN MIE 15.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "LS MIE 16.45 CP", students: [], teacher: "CP", course: "LS" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 1, classCode: "QUI MIE 16.45 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 3, classCode: "M1 MIE 16.45 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 3, classCode: "LT MIE 18.00 CP", students: [], teacher: "CP", course: "LT" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 5, classCode: "BIO MIE 18.00 FM", students: ["Emilia Gomez","Karla Casanova","Javier Luders","Maximo Riquelme","Tomás Recabarren","O: Gaspar Nisin"], teacher: "FM", course: "BIO" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 6, classCode: "M2 MIE 18.00 JR", students: ["LEONOR MARTINEZ (CONFIRMAR)","VICENTE MIRANDA (CONFIRMAR)","TOMAS DIAZ (CONFIRMAR)","Cristobal Kind","Vicente Urrutia"], teacher: "JR", course: "M2" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 1, classCode: "CS MIE 18.00 CA", students: [], teacher: "CA", course: "CS" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MIE 18.00 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO MIE 18.00 SS", students: ["Josefina Henning","Leonor Alcalde","Maite bastias","Valentine Panichine"], teacher: "SS", course: "BIO" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 5, classCode: "LN MIE 18.00 KG", students: [], teacher: "KG", course: "LN" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 5, classCode: "BIO MIE 19.15 FM", students: ["Emilia Gomez","Karla Casanova","Javier Luders","Maximo Riquelme","Clemente Sanhueza","Javiera Salvatici","Martina Ortiz","Leonor Alcalde"], teacher: "FM", course: "BIO" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 6, classCode: "M1 MIE 19.15 JR", students: ["LEONOR MARTINEZ (CONFIRMAR)","VICENTE MIRANDA (CONFIRMAR)","TOMAS DIAZ (CONFIRMAR)","Cristobal Kind","Vicente Urrutia","Valentina Panichine","Maite bastias"], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MIE 19.15 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO MIE 19.15 SS", students: ["Josefina Henning","Leonor Alcalde","Maite bastias"], teacher: "SS", course: "BIO" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 4, classCode: "M1 MIE 19.15 KG", students: [], teacher: "KG", course: "M1" },

  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 10.30 PF", students: ["Agustina Morales","Alvaro Colomera","Agustín Llanquihuen"], teacher: "PF", course: "M1" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI JUE 10.30 CA", students: ["Barbara Peña","Catalina Pritzke","Amanda Muñoz"], teacher: "CA", course: "QUI" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 5, classCode: "LN JUE 10.30 SC", students: ["Fernanda Lassalle","Amaro Godoy","Agustina Gutierrez"], teacher: "SC", course: "LN" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 6, classCode: "BIO JUE 10.30 AV", students: ["Florencia Pooley","Francisca Leal","Maitte Jofre","Rafael Briceño"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 JUE 10.30 JR", students: ["Emilia Martínez","Emilio Del","Valentina Araneda","Valentina Lincolao"], teacher: "JR", course: "M1" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 4, classCode: "BIO INT JUE 10.30 FM", students: ["Florencia Pooley","Francisca Leal","Maitte Jofre","María Estrada","Martina Sanchez","Rafael Briceño"], teacher: "FM", course: "BIO INT" },
  { day: "JUEVES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 2, classCode: "LN JUE 15.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "JUEVES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI JUE 15.30 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "JUEVES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 4, classCode: "FIS JUE 15.30 DE", students: [], teacher: "DE", course: "FIS" },
  { day: "JUEVES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 16.45 JR", students: ["Antonella Valdes","Bastian Henning","Emilia Huenchullan","Juan Saez","Nicolas Jofré","Nicolas Vidal","Vicente Canteros"], teacher: "JR", course: "M1" },
  { day: "JUEVES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "QUI JUE 16.45 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "JUEVES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 6, classCode: "BIO JUE 16.45 AV", students: ["Amparo Birke","Barbara Diaz","Ignacio Valenzuela","Isidora Rivas","Joaquin Perez","José Hoyuela"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 18.00 PF", students: ["Agustin Alister","Isidora Monsalve","Isidora Buck","León Kehr","María Albornoz","Nicolas Jofré","Vicente Canteros"], teacher: "PF", course: "M1" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 2, classCode: "BIO JUE 18.00 AV", students: ["Amparo Birke","Antonella Espinoza","Benjamin Cid","Isidora San","Martina Valdés","Vicente Toro"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 5, classCode: "LN JUE 18.00 SC", students: ["Catalina Cornejo","Leonor Martinez","Vicente Miranda","Isidora Arriagada","Rodrigo Moscoso","Mateo Zavala","Vicente Paslack"], teacher: "SC", course: "LN" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 6, classCode: "MT JUE 18.00 JR", students: ["LEONOR MARTINEZ (CONFIRMAR)","VICENTE MIRANDA (CONFIRMAR)","TOMAS DIAZ (CONFIRMAR)","Cristobal Kind","Vicente Urrutia","Emilia Gomez","Karla Casanova","Jacobe henriquez","Maximo Riquelme","Tomás Recabarren"], teacher: "JR", course: "MT" },
  { day: "JUEVES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 19.15 PF", students: ["Antonella Valdes","Bastian Henning","Emilia Huenchullan","Juan Saez","Nicolas Jofré","Catalina Gonzalez","Emilia Navarrete"], teacher: "PF", course: "M1" },
  { day: "JUEVES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 2, classCode: "BIO JUE 19.15 AV", students: ["Amparo Birke","Camila Torres","Emilia Huenchullan","Bastian Henning","Antonella Valdes"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 6, classCode: "MT JUE 19.15 JR", students: ["Emilia Gomez","Karla Casanova","Elisa Gonzalez","Emilia Navarrete","Emilio Flores","Juan Carrillo","Wilfred Noel"], teacher: "JR", course: "MT" },

  { day: "VIERNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "FIS VIE 10.30 DE", students: ["Agustín Llanquihuen","Benjamin Díaz","Amaro Godoy"], teacher: "DE", course: "FIS" },
  { day: "VIERNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 4, classCode: "LN VIE 10.30 SC", students: ["Agustina Morales","Francisca Torrejón","Matilde Yañez","Mia Vasconez","Vicente Caballero","Sofia Gomez"], teacher: "SC", course: "LN" },
  { day: "VIERNES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 1, classCode: "LN VIE 10.30 CP", students: ["Fernanda Lassalle","Barbara Peña","Amaro Godoy"], teacher: "CP", course: "LN" },
];

export function getUniqueCourses(): string[] {
  return [...new Set(scheduleData.map(e => e.course))].sort();
}

export function getUniqueTeachers(): string[] {
  return [...new Set(scheduleData.map(e => e.teacher))].sort();
}

export function filterSchedule(filters: {
  course?: string;
  sede?: string;
  day?: string;
  teacher?: string;
  search?: string;
}): ClassEntry[] {
  return scheduleData.filter(entry => {
    if (filters.course && entry.course !== filters.course) return false;
    if (filters.sede && entry.sede !== filters.sede) return false;
    if (filters.day && entry.day !== filters.day) return false;
    if (filters.teacher && entry.teacher !== filters.teacher) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        entry.course.toLowerCase().includes(q) ||
        entry.classCode.toLowerCase().includes(q) ||
        entry.teacher.toLowerCase().includes(q) ||
        entry.students.some(s => s.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });
}

export function getBaseCourse(course: string): string {
  return course.split(' ')[0];
}

export interface DuplicateConflict {
  student: string;
  otherEntry: ClassEntry;
}

export function getConflictsForEntry(entry: ClassEntry): DuplicateConflict[] {
  const baseCourse = getBaseCourse(entry.course);
  const conflicts: DuplicateConflict[] = [];

  for (const student of entry.students) {
    const otherEntries = scheduleData.filter(
      e =>
        e !== entry &&
        getBaseCourse(e.course) === baseCourse &&
        e.students.includes(student)
    );
    for (const other of otherEntries) {
      conflicts.push({ student, otherEntry: other });
    }
  }

  return conflicts;
}
