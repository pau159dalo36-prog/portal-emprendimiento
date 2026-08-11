// Diversidad determinista del feed. NO se aplica en SQL: el orden SQL es el
// orden de rango que define el cursor (estable para la paginación). Aquí se
// REORDENA cada página en la capa de aplicación sin eliminar candidatos.
//
// Reglas (iniciales):
//   - máximo 2 posts consecutivos del mismo autor;
//   - intentar evitar > 3 consecutivos del mismo proyecto / organización;
//   - si no hay suficientes candidatos, la restricción se relaja (el algoritmo
//     SIEMPRE coloca todos los items).
//
// El algoritmo es estable y determinista: recorre la lista en orden; para cada
// posición elige el primer candidato restante que no rompe las restricciones
// (y si ninguno vale, el primero, relajando). Como recibe la misma entrada,
// produce la misma salida → sin duplicados ni saltos entre páginas. El cursor
// de la siguiente página se deriva del ÚLTIMO item del orden SQL del lote (no
// del orden reordenado), por lo que la diversidad no desincroniza la paginación.
import {
  DIVERSITY_MAX_CONSECUTIVE_AUTHOR,
  DIVERSITY_MAX_CONSECUTIVE_ORGANIZATION,
  DIVERSITY_MAX_CONSECUTIVE_PROJECT,
} from "@/feed/config";

export type DiversityItem = {
  authorId: string;
  projectId: string | null;
  organizationId: string | null;
};

export type DiversityLimits = {
  maxConsecutiveAuthor?: number;
  maxConsecutiveProject?: number;
  maxConsecutiveOrganization?: number;
};

type RunState = {
  author: number;
  project: number;
  organization: number;
};

export function applyDiversity<T extends DiversityItem>(
  items: readonly T[],
  limits: DiversityLimits = {},
): T[] {
  if (items.length <= 1) {
    return [...items];
  }

  const maxAuthor = limits.maxConsecutiveAuthor ?? DIVERSITY_MAX_CONSECUTIVE_AUTHOR;
  const maxProject = limits.maxConsecutiveProject ?? DIVERSITY_MAX_CONSECUTIVE_PROJECT;
  const maxOrganization =
    limits.maxConsecutiveOrganization ?? DIVERSITY_MAX_CONSECUTIVE_ORGANIZATION;

  const remaining = [...items];
  const result: T[] = [];
  let run: RunState = { author: 0, project: 0, organization: 0 };

  while (remaining.length > 0) {
    let chosenIndex = 0;
    for (let index = 0; index < remaining.length; index++) {
      if (
        !wouldExceedRun(remaining[index], result[result.length - 1], run, {
          maxConsecutiveAuthor: maxAuthor,
          maxConsecutiveProject: maxProject,
          maxConsecutiveOrganization: maxOrganization,
        })
      ) {
        chosenIndex = index;
        break;
      }
    }

    const [chosen] = remaining.splice(chosenIndex, 1);
    result.push(chosen);
    run = advanceRun(chosen, result[result.length - 2], run);
  }

  return result;
}

function wouldExceedRun(
  candidate: DiversityItem,
  last: DiversityItem | undefined,
  run: RunState,
  max: Required<DiversityLimits>,
): boolean {
  if (!last) {
    return false;
  }
  if (candidate.authorId === last.authorId && run.author >= max.maxConsecutiveAuthor) {
    return true;
  }
  if (
    candidate.projectId != null &&
    candidate.projectId === last.projectId &&
    run.project >= max.maxConsecutiveProject
  ) {
    return true;
  }
  if (
    candidate.organizationId != null &&
    candidate.organizationId === last.organizationId &&
    run.organization >= max.maxConsecutiveOrganization
  ) {
    return true;
  }
  return false;
}

function advanceRun(
  chosen: DiversityItem,
  last: DiversityItem | undefined,
  run: RunState,
): RunState {
  const sameAuthor = last?.authorId === chosen.authorId;
  const sameProject = chosen.projectId != null && last?.projectId === chosen.projectId;
  const sameOrganization =
    chosen.organizationId != null && last?.organizationId === chosen.organizationId;
  return {
    author: sameAuthor ? run.author + 1 : 1,
    project: sameProject ? run.project + 1 : chosen.projectId ? 1 : 0,
    organization: sameOrganization ? run.organization + 1 : chosen.organizationId ? 1 : 0,
  };
}
