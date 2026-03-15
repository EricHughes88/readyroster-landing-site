// lib/jobLock.ts
import { pool } from "@/lib/db";

type AcquireResult = {
  acquired: boolean;
};

export async function acquireJobLock(
  jobName: string,
  ttlMinutes = 15
): Promise<AcquireResult> {
  const q = await pool.query(
    `
    INSERT INTO public.job_locks (
      job_name,
      locked_at,
      lock_expires_at,
      last_status,
      updated_at
    )
    VALUES (
      $1,
      NOW(),
      NOW() + ($2 || ' minutes')::interval,
      'running',
      NOW()
    )
    ON CONFLICT (job_name)
    DO UPDATE SET
      locked_at = CASE
        WHEN public.job_locks.lock_expires_at IS NULL
          OR public.job_locks.lock_expires_at < NOW()
        THEN NOW()
        ELSE public.job_locks.locked_at
      END,
      lock_expires_at = CASE
        WHEN public.job_locks.lock_expires_at IS NULL
          OR public.job_locks.lock_expires_at < NOW()
        THEN NOW() + ($2 || ' minutes')::interval
        ELSE public.job_locks.lock_expires_at
      END,
      last_status = CASE
        WHEN public.job_locks.lock_expires_at IS NULL
          OR public.job_locks.lock_expires_at < NOW()
        THEN 'running'
        ELSE public.job_locks.last_status
      END,
      updated_at = NOW()
    WHERE public.job_locks.lock_expires_at IS NULL
       OR public.job_locks.lock_expires_at < NOW()
    RETURNING job_name
    `,
    [jobName, String(ttlMinutes)]
  );

  return { acquired: q.rows.length > 0 };
}

export async function releaseJobLock(
  jobName: string,
  status: "success" | "failed"
) {
  await pool.query(
    `
    UPDATE public.job_locks
    SET
      locked_at = NULL,
      lock_expires_at = NULL,
      last_run_at = NOW(),
      last_status = $2,
      updated_at = NOW()
    WHERE job_name = $1
    `,
    [jobName, status]
  );
}