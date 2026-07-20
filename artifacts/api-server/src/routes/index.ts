import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scheduleRouter from "./schedule";
import tasksRouter from "./tasks";
import teamRouter from "./team";
import workshopsRouter from "./workshops";
import orientacionRouter from "./orientacion";
import notasRouter from "./notas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scheduleRouter);
router.use(tasksRouter);
router.use(teamRouter);
router.use(workshopsRouter);
router.use(orientacionRouter);
router.use(notasRouter);

export default router;
