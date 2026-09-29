// Loads the curriculum data built by pipeline/curriculum/build_curriculum.py

// This page lives one folder below the site root, next to the shared data folder
const DATA = `${import.meta.env.BASE_URL}../data/curriculum/`

export async function loadCurriculum() {
  const [courses, programs, meta] = await Promise.all(['courses', 'programs', 'meta'].map(async (name) => {
    const res = await fetch(`${DATA}${name}.json`)
    if (!res.ok) throw new Error(`Couldn't load data/curriculum/${name}.json (${res.status})`)
    return res.json()
  }))
  return { courses, programs, meta }
}

// How much sustainability a program builds in, from most to least
export const STANDING = {
  required: { label: 'Requires a sustainability course', short: 'Requires one' },
  option: { label: 'Offers sustainability courses as options', short: 'Offers options' },
  none: { label: 'Names no sustainability course', short: 'Names none' },
}

export function standing(program) {
  if (program.required.length > 0) return 'required'
  if (program.options.length > 0) return 'option'
  return 'none'
}

export const facultyMapLink = (personId) => `../?person=${encodeURIComponent(personId)}`

export const PROGRAM_TYPES = ["Bachelor's", 'Minor', "Master's", 'Certificate', 'Doctorate', 'Other']
