import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../shared/ui/Button/Button'
import { usePatientSearch } from './usePatientSearch'
import styles from './PatientSearch.module.css'

export const PATIENT_SEARCH_ID = 'patients'

function SearchResults({ input }: { input: string }) {
  const { query, search } = usePatientSearch(input)

  if (query === '') {
    return <p className={styles.hint}>Search by name or personal number.</p>
  }

  if (search.isPending) {
    return (
      <p className={styles.hint} role="status">
        Searching…
      </p>
    )
  }

  if (search.isError) {
    return (
      <div className={styles.state}>
        <p role="alert">{search.error.message}</p>
        <Button onClick={() => void search.refetch()} disabled={search.isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  if (search.data.length === 0) {
    return <p className={styles.hint}>No patients match “{query}”.</p>
  }

  return (
    <ul className={styles.results}>
      {search.data.map((patient) => (
        <li key={patient.id}>
          <Link to={`/patients/${patient.id}`} className={styles.result}>
            <span className={styles.name}>{patient.name}</span>
            <span className={styles.personalNumber}>{patient.personalNumber}</span>
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function PatientSearch() {
  const [input, setInput] = useState('')

  return (
    <section id={PATIENT_SEARCH_ID} className={styles.section} aria-labelledby="patients-heading">
      <h2 id="patients-heading" className={styles.heading}>
        Patients
      </h2>
      <form className={styles.form} role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="patient-search" className={styles.label}>
          Search patients
        </label>
        <input
          id="patient-search"
          type="search"
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Name or personal number"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
      <SearchResults input={input} />
    </section>
  )
}
