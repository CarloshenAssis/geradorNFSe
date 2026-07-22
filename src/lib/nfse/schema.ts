import { z } from "zod";

/**
 * Validação estrutural do XML já parseado (substituto leve de XSD completo,
 * item 3.1/2.5 do MD: nunca confiar no XML enviado pelo usuário). Cobre os
 * campos do layout NT 008/2026 v2.0 presentes no exemplo de referência.
 */

const enderecoSchema = z.object({
  xLgr: z.string().min(1),
  nro: z.string().min(1),
  xBairro: z.string().min(1),
  cMun: z.string().min(1),
  xMun: z.string().min(1),
  UF: z.string().length(2),
  CEP: z.string().min(1),
});

const regTribSchema = z
  .object({
    opSimpNac: z.string().optional(),
    regApTribSN: z.string().optional(),
    regEspTrib: z.string().optional(),
  })
  .optional();

const prestadorSchema = z.object({
  CNPJ: z.string().regex(/^\d{14}$/, "CNPJ do prestador inválido").optional(),
  CPF: z
    .string()
    .regex(/^\d{11}$/)
    .optional(),
  IM: z.string().optional(),
  xNome: z.string().min(1),
  fone: z.string().optional(),
  email: z.string().email().optional(),
  end: enderecoSchema.optional(),
  regTrib: regTribSchema,
});

const tomadorSchema = z
  .object({
    CNPJ: z
      .string()
      .regex(/^\d{14}$/)
      .optional(),
    CPF: z
      .string()
      .regex(/^\d{11}$/)
      .optional(),
    IM: z.string().optional(),
    xNome: z.string().min(1),
    fone: z.string().optional(),
    email: z.string().email().optional(),
    end: enderecoSchema.optional(),
  })
  .refine((t) => Boolean(t.CNPJ || t.CPF), { message: "Tomador precisa ter CNPJ ou CPF" });

const servicoSchema = z.object({
  cServ: z.object({
    cTribNac: z.string().min(1),
    cTribMun: z.string().optional(),
    cNBS: z.string().optional(),
    xDescServ: z.string().min(1),
    xTribNac: z.string().optional(),
    xTribMun: z.string().optional(),
  }),
  locPrest: z
    .object({
      cLocPrestacao: z.string().optional(),
      cPaisPrestacao: z.string().optional(),
    })
    .optional(),
  xDiscr: z.string().min(1),
  infoCompl: z
    .object({
      xInfComp: z.string().optional(),
    })
    .optional(),
});

const grupoTributoIbsCbsSchema = z
  .object({
    pIBSUF: z.coerce.number().optional(),
    vIBSUF: z.coerce.number().optional(),
    pIBSMun: z.coerce.number().optional(),
    vIBSMun: z.coerce.number().optional(),
    pCBS: z.coerce.number().optional(),
    vCBS: z.coerce.number().optional(),
  })
  .partial();

const descontosSchema = z
  .object({
    vDescIncond: z.coerce.number().optional(),
    vDescCond: z.coerce.number().optional(),
  })
  .optional();

const valoresDpsSchema = z.object({
  vServPrest: z.object({ vServ: z.coerce.number().nonnegative() }),
  vDescCondIncond: descontosSchema,
  trib: z
    .object({
      tribMun: z
        .object({
          tribISSQN: z.string(),
          pAliq: z.coerce.number().nonnegative().optional(),
          tpRetISSQN: z.string().optional(),
        })
        .optional(),
      tribFed: z
        .object({
          piscofins: z
            .object({
              CST: z.string().optional(),
              vPis: z.coerce.number().optional(),
              vCofins: z.coerce.number().optional(),
              tpRetPisCofins: z.string().optional(),
            })
            .optional(),
          vRetIRRF: z.coerce.number().optional(),
          vRetCP: z.coerce.number().optional(),
          vRetCSLL: z.coerce.number().optional(),
        })
        .optional(),
      totTrib: z
        .object({
          indTotTrib: z.string().optional(),
          pTotTribSN: z.coerce.number().optional(),
          vTotTribFed: z.coerce.number().optional(),
          vTotTribEst: z.coerce.number().optional(),
          vTotTribMun: z.coerce.number().optional(),
          pTotTribFed: z.coerce.number().optional(),
          pTotTribEst: z.coerce.number().optional(),
          pTotTribMun: z.coerce.number().optional(),
        })
        .optional(),
      IBSCBS: z
        .object({
          CST: z.string(),
          cClassTrib: z.string(),
          gIBSCBS: z
            .object({
              vBC: z.coerce.number(),
              gIBSUF: grupoTributoIbsCbsSchema.optional(),
              gIBSMun: grupoTributoIbsCbsSchema.optional(),
              gCBS: grupoTributoIbsCbsSchema.optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const infDpsSchema = z.object({
  "@_Id": z.string().min(1),
  tpAmb: z.string(),
  dhEmi: z.string().min(1),
  verAplic: z.string(),
  serie: z.string(),
  nDPS: z.string(),
  dCompet: z.string(),
  tpEmit: z.string(),
  finNFSe: z.string().optional(),
  cLocEmi: z.string(),
  prest: prestadorSchema,
  toma: tomadorSchema.optional(),
  serv: servicoSchema,
  valores: valoresDpsSchema,
});

const valoresNfseSchema = z.object({
  vISSQN: z.coerce.number().nonnegative(),
  vTotalRet: z.coerce.number().nonnegative().optional(),
  vLiq: z.coerce.number().nonnegative(),
});

const infNfseSchema = z.object({
  "@_Id": z.string().min(1),
  xLocEmi: z.string().min(1),
  xLocPrestacao: z.string().min(1),
  nNFSe: z.string().min(1),
  cLocIncid: z.string().min(1),
  xLocIncid: z.string().min(1),
  dhProc: z.string().min(1),
  verAplic: z.string().optional(),
  ambGer: z.string().optional(),
  cStat: z.string().optional(),
  chaveAcesso: z.string().regex(/^\d{40,50}$/, "chave de acesso com tamanho inesperado"),
  valores: valoresNfseSchema,
  DPS: z.object({ infDPS: infDpsSchema }),
});

export const nfseRootSchema = z.object({
  NFSe: z.object({ infNFSe: infNfseSchema }),
});

export type NfseParsed = z.infer<typeof nfseRootSchema>;

export class NfseValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(`XML não segue o layout esperado: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
}

export function validateNfse(raw: unknown): NfseParsed {
  const result = nfseRootSchema.safeParse(raw);
  if (!result.success) {
    throw new NfseValidationError(result.error.issues);
  }
  return result.data;
}
