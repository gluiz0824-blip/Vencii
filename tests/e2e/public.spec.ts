import { expect, test } from "@playwright/test";

test("landing apresenta a proposta da Vencii", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Contas organizadas. Decisões mais tranquilas.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Não somos banco e não executamos pagamentos."),
  ).toBeVisible();
});

test("health expõe apenas o estado da aplicação", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({
    status: "ok",
    application: "vencii",
  });
});

test("área do produto exige autenticação", async ({ page }) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta" }),
  ).toBeVisible();
});

test("cadastro e recuperação expõem formulários acessíveis", async ({
  page,
}) => {
  await page.goto("/cadastro");

  await expect(
    page.getByRole("heading", { name: "Crie sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();

  await page.goto("/recuperar-senha");

  await expect(
    page.getByRole("heading", { name: "Recuperar acesso" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar instruções" }),
  ).toBeVisible();
});
