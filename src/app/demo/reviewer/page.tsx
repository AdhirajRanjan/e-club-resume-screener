import { Back } from "@/components/ui";

export const metadata = { title: "Reviewer example" };

export default function DemoReviewer() {
  return <>
    <Back href="/demo">Example projects</Back>
    <header className="page-heading">
      <span className="pill">Synthetic applicant records</span>
      <h1>Reviewer example</h1>
      <p>Illustrative results for Campus Marketplace. No resumes were screened to produce these examples.</p>
    </header>
    <div className="panel table-scroll">
      <table>
        <caption className="sr-only">Illustrative applicant ranking for Campus Marketplace</caption>
        <thead><tr><th>Applicant</th><th>Example score</th><th>Recommendation</th><th>Example decision</th></tr></thead>
        <tbody>
          <tr><th scope="row">Applicant A</th><td>85 / 100</td><td><span className="pill bucket-yes">Yes</span></td><td>Shortlist</td></tr>
          <tr><th scope="row">Applicant B</th><td>60 / 100</td><td><span className="pill bucket-maybe">Maybe</span></td><td>Hold</td></tr>
        </tbody>
      </table>
    </div>
    <section className="panel card form-stack application-panel">
      <h2>Example evidence for Applicant A</h2>
      <p><strong>Matched:</strong> Built a React prototype for a student-club event listing.</p>
      <p><strong>Unverified:</strong> User interview experience was omitted from the sample submission.</p>
      <p>Viewing resumes, editing decisions, and exporting a CSV require the live backend.</p>
    </section>
  </>;
}
