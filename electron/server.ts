import { utilityProcess } from 'electron';
import path from 'path';
import { isDev, DEV_PORT, isPortAvailable, findFreePort, waitForServer } from './utils';

let nextServer: Electron.UtilityProcess | null = null;

export async function startNextServer(): Promise<string> {
  if (isDev) return `http://localhost:${DEV_PORT}`;

  // 23000번 포트 우선 사용 (API 서버 CORS 설정과 일치)
  // 사용 중이면 랜덤 포트로 fallback
  const preferred = await isPortAvailable(DEV_PORT);
  const port = preferred ? DEV_PORT : await findFreePort();

  const standaloneDir = path.join(process.resourcesPath, 'standalone', 'hiveworks', 'hive-talk-desktop-app');
  const serverPath = path.join(standaloneDir, 'server.js');

  nextServer = utilityProcess.fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: 'localhost',
    },
  });

  nextServer.stdout?.on('data', (d: Buffer) => console.log('[next]', d.toString().trim()));
  nextServer.stderr?.on('data', (d: Buffer) => console.error('[next]', d.toString().trim()));

  const url = `http://localhost:${port}`;
  await waitForServer(url);
  return url;
}

export function killNextServer() {
  nextServer?.kill();
}
