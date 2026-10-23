"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { useActionState, useState } from "react";
import { type FieldPath, useForm, useWatch } from "react-hook-form";

import { completeOnboardingAction } from "@/app/actions/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { INITIAL_FORM_STATE } from "@/validation/form-state";
import {
  type OnboardingData,
  onboardingOrganizationSchema,
  onboardingProfileSchema,
} from "@/validation/onboarding";

const steps = [
  { title: "Seus dados", icon: UserRound },
  { title: "Empresa", icon: Building2 },
  { title: "Preferências", icon: Check },
] as const;

interface OnboardingFormProps {
  defaultName: string;
}

export function OnboardingForm({ defaultName }: OnboardingFormProps) {
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    INITIAL_FORM_STATE,
  );
  const {
    control,
    register,
    getValues,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm<OnboardingData>({
    defaultValues: {
      fullName: defaultName,
      phone: "",
      legalName: "",
      tradeName: "",
      cnpj: "",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
    },
  });

  function advance() {
    clearErrors();
    const schema =
      step === 0 ? onboardingProfileSchema : onboardingOrganizationSchema;
    const result = schema.safeParse(getValues());

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string")
          setError(field as FieldPath<OnboardingData>, {
            message: issue.message,
          });
      });
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  const timezone = useWatch({ control, name: "timezone" });

  return (
    <form action={action} className="space-y-7" noValidate>
      <ol className="grid grid-cols-3 gap-2" aria-label="Etapas do onboarding">
        {steps.map(({ title, icon: Icon }, index) => (
          <li
            key={title}
            className={cn(
              "flex items-center gap-2 border-b-2 pb-3 text-xs font-medium",
              index <= step
                ? "border-primary text-foreground"
                : "border-border text-muted-foreground",
            )}
            aria-current={index === step ? "step" : undefined}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full",
                index <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="hidden sm:inline">{title}</span>
          </li>
        ))}
      </ol>

      <section
        hidden={step !== 0}
        aria-labelledby="profile-step-title"
        className="space-y-4"
      >
        <div>
          <h2 id="profile-step-title" className="text-xl font-semibold">
            Vamos começar por você
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Esses dados identificam suas ações dentro das organizações.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            {...register("fullName")}
            aria-invalid={Boolean(
              errors.fullName || state.fieldErrors?.fullName,
            )}
          />
          {(errors.fullName?.message ?? state.fieldErrors?.fullName?.[0]) && (
            <p className="text-destructive text-xs">
              {errors.fullName?.message ?? state.fieldErrors?.fullName?.[0]}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            Telefone{" "}
            <span className="text-muted-foreground font-normal">
              (opcional)
            </span>
          </Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            {...register("phone")}
          />
          {errors.phone?.message && (
            <p className="text-destructive text-xs">{errors.phone.message}</p>
          )}
        </div>
      </section>

      <section
        hidden={step !== 1}
        aria-labelledby="organization-step-title"
        className="space-y-4"
      >
        <div>
          <h2 id="organization-step-title" className="text-xl font-semibold">
            Agora, sua empresa
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Você será definido como owner desta primeira organização.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="legalName">Razão social</Label>
          <Input
            id="legalName"
            {...register("legalName")}
            aria-invalid={Boolean(
              errors.legalName || state.fieldErrors?.legalName,
            )}
          />
          {(errors.legalName?.message ?? state.fieldErrors?.legalName?.[0]) && (
            <p className="text-destructive text-xs">
              {errors.legalName?.message ?? state.fieldErrors?.legalName?.[0]}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradeName">Nome fantasia</Label>
          <Input
            id="tradeName"
            {...register("tradeName")}
            aria-invalid={Boolean(
              errors.tradeName || state.fieldErrors?.tradeName,
            )}
          />
          {(errors.tradeName?.message ?? state.fieldErrors?.tradeName?.[0]) && (
            <p className="text-destructive text-xs">
              {errors.tradeName?.message ?? state.fieldErrors?.tradeName?.[0]}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj">
            CNPJ{" "}
            <span className="text-muted-foreground font-normal">
              (opcional)
            </span>
          </Label>
          <Input
            id="cnpj"
            inputMode="numeric"
            placeholder="00.000.000/0001-00"
            {...register("cnpj")}
          />
          {errors.cnpj?.message && (
            <p className="text-destructive text-xs">{errors.cnpj.message}</p>
          )}
        </div>
      </section>

      <section
        hidden={step !== 2}
        aria-labelledby="preferences-step-title"
        className="space-y-4"
      >
        <div>
          <h2 id="preferences-step-title" className="text-xl font-semibold">
            Preferências básicas
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            O fuso define como datas e horários operacionais serão apresentados.
          </p>
        </div>
        <input type="hidden" {...register("timezone")} />
        <input type="hidden" value="BRL" {...register("currency")} />
        <div className="space-y-2">
          <Label htmlFor="timezone">Fuso horário</Label>
          <Select
            value={timezone}
            onValueChange={(value) =>
              setValue("timezone", value as OnboardingData["timezone"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Sao_Paulo">
                Brasília — São Paulo
              </SelectItem>
              <SelectItem value="America/Manaus">Manaus</SelectItem>
              <SelectItem value="America/Recife">Recife</SelectItem>
              <SelectItem value="America/Fortaleza">Fortaleza</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="bg-muted/40 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium">
            Moeda da organização
          </p>
          <p className="mt-1 font-semibold">Real brasileiro (BRL)</p>
        </div>
      </section>

      {state.message && (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || pending}
        >
          <ArrowLeft /> Voltar
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={advance}>
            Continuar <ArrowRight />
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" /> Criando organização...
              </>
            ) : (
              <>
                Concluir onboarding <Check />
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
