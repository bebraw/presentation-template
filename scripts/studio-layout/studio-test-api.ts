import { listDrawerBodyClasses, listDrawerSelectors } from "../../studio/client/shell/drawer-tool-model.ts";

type Page = import("playwright").Page;

type StudioTestApi = {
  closeAllDrawers: () => Promise<void>;
  waitForStudioIdle: () => Promise<void>;
};

type StudioTestWindow = Window & {
  __slideotterTest?: StudioTestApi;
};

const drawerSelectors = listDrawerSelectors();
const drawerBodyClasses = [...listDrawerBodyClasses(), "drawer-switching"];

async function hasStudioTestApi(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean((window as StudioTestWindow).__slideotterTest));
}

export async function normalizeStudioForLayoutValidation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  });

  if (await hasStudioTestApi(page)) {
    await page.evaluate(async () => {
      await (window as StudioTestWindow).__slideotterTest?.waitForStudioIdle();
    });
  } else {
    await page.keyboard.press("Escape");
  }

  await page.mouse.move(0, 0);
  await page.waitForFunction(
    ({ bodyClasses, selectors }) => {
      const drawersClosed = selectors.every((selector) => {
        return document.querySelector(selector)?.getAttribute("data-open") !== "true";
      });
      const bodyClassesClosed = bodyClasses.every((className) => !document.body.classList.contains(className));
      return drawersClosed && bodyClassesClosed;
    },
    { bodyClasses: drawerBodyClasses, selectors: drawerSelectors }
  );
}
