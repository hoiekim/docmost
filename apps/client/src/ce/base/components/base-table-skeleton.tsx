import { Skeleton } from "@mantine/core";
import classes from "../styles/skeleton.module.css";

type Props = { rows?: number; columns?: number };

/** Placeholder shown while a base loads or before the server assigns its id. */
export function BaseTableSkeleton({ rows = 3, columns = 3 }: Props) {
  const cols = Array.from({ length: Math.max(1, columns) });
  return (
    <div className={classes.root} aria-hidden="true">
      <div className={classes.toolbar}>
        <Skeleton height={22} width={90} radius="sm" />
        <Skeleton height={22} width={60} radius="sm" />
        <Skeleton height={22} width={60} radius="sm" />
      </div>
      <div className={classes.table}>
        <div className={classes.row}>
          {cols.map((_, i) => (
            <div key={i} className={classes.cell}>
              <Skeleton height={12} width="55%" radius="sm" />
            </div>
          ))}
        </div>
        {Array.from({ length: Math.max(1, rows) }).map((_, r) => (
          <div key={r} className={classes.row}>
            {cols.map((_, i) => (
              <div key={i} className={classes.cell}>
                <Skeleton height={12} width={`${45 + ((r + i) % 3) * 15}%`} radius="sm" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
