import type { StudioClientNavigationShell } from "../shell/navigation-shell.ts";

type NavigationShell = ReturnType<typeof StudioClientNavigationShell.createNavigationShell>;
type DrawerRailState = StudioClientNavigationShell.DrawerRailState;

export type StudioTestApi = {
  closeAllDrawers: () => Promise<void>;
  getDrawerRailState: () => DrawerRailState[];
  waitForNavigationSettled: () => Promise<void>;
  waitForStudioIdle: () => Promise<void>;
};

type StudioTestWindow = Window & {
  __slideotterTest?: StudioTestApi;
};

function waitForAnimationFrame(windowRef: Window): Promise<void> {
  return new Promise((resolve) => {
    windowRef.requestAnimationFrame(() => resolve());
  });
}

async function waitForDrawerSwitchingToSettle(documentRef: Document, windowRef: Window): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await waitForAnimationFrame(windowRef);
    if (!documentRef.body.classList.contains("drawer-switching")) {
      return;
    }
  }
}

export function mountStudioTestApi(options: {
  documentRef: Document;
  navigationShell: NavigationShell;
  windowRef: Window;
}): void {
  const { documentRef, navigationShell, windowRef } = options;
  const testWindow = windowRef as StudioTestWindow;

  async function waitForNavigationSettled(): Promise<void> {
    await waitForAnimationFrame(windowRef);
    await waitForAnimationFrame(windowRef);
  }

  async function closeAllDrawers(): Promise<void> {
    const activeElement = documentRef.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    navigationShell.closeAllDrawers();
    await waitForNavigationSettled();
    await waitForDrawerSwitchingToSettle(documentRef, windowRef);
  }

  async function waitForStudioIdle(): Promise<void> {
    await closeAllDrawers();
    await waitForNavigationSettled();
  }

  testWindow.__slideotterTest = {
    closeAllDrawers,
    getDrawerRailState: navigationShell.getDrawerRailState,
    waitForNavigationSettled,
    waitForStudioIdle
  };
}
