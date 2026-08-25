import { Injectable } from '@nestjs/common';

interface FailRecord {
  count: number;
  /** 窗口起点时间戳（用于判断 5 分钟窗口是否过期）。 */
  windowStart: number;
  lockUntil: number;
}

/**
 * 登录失败限流（内存实现，无需外部存储）：
 * - 同一用户名 5 分钟内连续失败 ≥ 5 次 → 锁定 15 分钟（防单一账号爆破）。
 * - 同一 IP 5 分钟内连续失败 ≥ 20 次 → 锁定 15 分钟（防批量撞库，阈值更高避免误伤同网段用户）。
 * - 进程重启后计数清零（单实例部署足够，多实例可扩展为 Redis）。
 */
@Injectable()
export class LoginThrottleService {
  private readonly failByUsername = new Map<string, FailRecord>();
  private readonly failByIp = new Map<string, FailRecord>();

  private readonly USERNAME_MAX_FAILS = 5;
  private readonly IP_MAX_FAILS = 20;
  private readonly WINDOW_MS = 5 * 60 * 1000; // 5 分钟窗口
  private readonly LOCK_MS = 15 * 60 * 1000; // 锁定 15 分钟

  private isLocked(record: FailRecord | undefined): boolean {
    if (!record) return false;
    return Date.now() < record.lockUntil;
  }

  /** 是否被锁定（用户名或 IP 任一命中即锁定）。 */
  isLockedKey(username: string, ip: string): boolean {
    return (
      this.isLocked(this.failByUsername.get(username)) ||
      this.isLocked(this.failByIp.get(ip))
    );
  }

  /** 记录一次失败。 */
  recordFailure(username: string, ip: string): void {
    const now = Date.now();
    const bump = (
      map: Map<string, FailRecord>,
      key: string,
      maxFails: number,
    ) => {
      const rec = map.get(key);
      // 无记录，或窗口已过期（距窗口起点超过 5 分钟）→ 重新计数
      if (!rec || now - rec.windowStart > this.WINDOW_MS) {
        map.set(key, { count: 1, windowStart: now, lockUntil: 0 });
        return;
      }
      rec.count += 1;
      if (rec.count >= maxFails) {
        rec.lockUntil = now + this.LOCK_MS;
        rec.count = 0;
      }
    };
    bump(this.failByUsername, username, this.USERNAME_MAX_FAILS);
    bump(this.failByIp, ip, this.IP_MAX_FAILS);
  }

  /** 登录成功后清除计数。 */
  clear(username: string, ip: string): void {
    this.failByUsername.delete(username);
    this.failByIp.delete(ip);
  }
}

