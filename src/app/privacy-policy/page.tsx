import React from "react";
import Link from "next/link";

export const metadata = {
    title: "Privacy Policy | Currio",
    description: "Currio Privacy Policy explaining how we collect, use, and protect your data while using our AI course generation platform.",
};

export default function PrivacyPolicyPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 bg-white min-h-screen">
            <nav className="mb-6 border-b border-gray-200" aria-label="Site">
                <div className="py-3 flex items-center justify-between">
                    <Link href="/" className="font-serif font-bold text-xl tracking-tight text-gray-900">
                        Currio
                    </Link>
                    <Link href="/" className="text-sm text-blue-600 hover:underline">
                        Return Home
                    </Link>
                </div>
            </nav>
            <article className="text-gray-800 leading-relaxed">
                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight mb-4 text-[#1A1A1A]">
                        Privacy Policy
                    </h1>
                    <p className="text-gray-500 text-sm">
                        <strong>Last Updated:</strong> <em>December 31, 2025</em>
                    </p>
                    <p className="mt-6 text-lg text-gray-600">
                        This Privacy Policy (&quot;Policy&quot;) explains how <strong>Currio</strong> (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, shares, and protects personal information when you use our AI-powered course generation platform, website, and related services (&quot;Services&quot;).
                    </p>
                    <p className="mt-3 text-gray-600">
                        By using Currio, you agree to the collection and use of information in accordance with this policy.
                    </p>
                </header>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">1. Information We Collect</h2>
                    <p className="mb-4">
                        We collect information that identifies, describes, relates to, or can reasonably be linked to you (&quot;Personal Information&quot;). We collect this data in three ways:
                    </p>
                    <ol className="list-decimal pl-6 mt-2 space-y-2 text-gray-700">
                        <li><strong>Information you provide directly</strong> (e.g., account details, prompts).</li>
                        <li><strong>Information collected automatically</strong> (e.g., device logs, cookies).</li>
                        <li><strong>Information from third parties</strong> (e.g., Google Authentication).</li>
                    </ol>
                    
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="font-semibold text-yellow-800 mb-2">⚠️ Important Note About Public Content</p>
                        <p className="text-sm text-yellow-800">
                            Currio is built as a collaborative knowledge platform. <strong>Courses generated on Currio are private by default.</strong> However, if you choose to publicly share your course (via the &quot;Make Public&quot; toggle), the title, structure, content, and your display name (as the creator) will be visible to other users via the &quot;Explore&quot; feed or search engines. Please do not include private, sensitive, or confidential personal data in your course prompts if you intend to share them publicly.
                        </p>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold mt-8 mb-3 text-[#1A1A1A]">1.1 Information You Provide</h3>
                    <h4 className="text-lg font-semibold mt-4 mb-1">Account Data</h4>
                    <p className="text-gray-700 mb-2">When you sign up or log in, we collect:</p>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                        <li>Name (Display Name)</li>
                        <li>Email address</li>
                        <li>Profile Picture (provided via Google Auth)</li>
                    </ul>
                    <p className="mt-2 text-sm text-gray-500">
                        We use <strong>Google Firebase Authentication</strong>. We do not store your passwords directly on our servers.
                    </p>

                    <h4 className="text-lg font-semibold mt-6 mb-1">Course Generation Data</h4>
                    <p className="text-gray-700 mb-2">To provide our core service, we collect:</p>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                        <li><strong>Prompts:</strong> The text queries you type to generate courses (e.g., &quot;History of Quantum Physics&quot;).</li>
                        <li><strong>Preferences:</strong> Settings related to course difficulty, language, or tone.</li>
                        <li><strong>Interaction Data:</strong> Quiz answers, podcast playback history, and &quot;saved&quot; courses.</li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-xl font-bold mt-8 mb-3 text-[#1A1A1A]">1.2 Information Collected Automatically</h3>
                    <p className="text-gray-700">We use cookies, local storage, and server logs to collect:</p>
                    <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700">
                        <li>IP address and general location (country/region).</li>
                        <li>Device type, operating system, and browser version.</li>
                        <li>Usage patterns (pages visited, time spent on courses).</li>
                        <li><strong>Redis Logs:</strong> Temporary data stored in our caching layer (Upstash) to facilitate streaming responses.</li>
                    </ul>
                </section>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">2. How We Use Your Data</h2>
                    <p className="mb-4 text-gray-700">We use your Personal Information for the following purposes:</p>

                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-gray-900">Service Provision & AI Generation</h4>
                            <p className="text-gray-700 text-sm">To process your prompts and generate educational content (text, quizzes, audio). Your prompts are transmitted to third-party AI providers (Google Gemini, OpenAI) solely to generate the requested response.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900">The Public Library</h4>
                            <p className="text-gray-700 text-sm">To index and display your generated courses in the Currio public library, allowing the community to learn from content you created.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900">Platform Improvement</h4>
                            <p className="text-gray-700 text-sm">To analyze which topics are popular, debug technical errors, and optimize the speed of our database queries.</p>
                        </div>
                    </div>
                </section>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">3. Third-Party AI & Processors</h2>
                    <p className="mb-4 text-gray-700">
                        Currio relies on advanced third-party Artificial Intelligence services to function. By using Currio, you acknowledge that specific data is shared with the following processors:
                    </p>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm whitespace-nowrap mb-6">
                            <thead className="uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-gray-600 font-bold">Provider</th>
                                    <th scope="col" className="px-6 py-3 text-gray-600 font-bold">Purpose</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 border border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-900">Google Gemini (Cloud)</th>
                                    <td className="px-6 py-3 text-gray-600">Content generation, structure, & grounding.</td>
                                </tr>
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-900">OpenAI</th>
                                    <td className="px-6 py-3 text-gray-600">Text-to-Speech (Podcast generation).</td>
                                </tr>
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-900">Google Firebase</th>
                                    <td className="px-6 py-3 text-gray-600">Authentication, Database, & File Storage.</td>
                                </tr>
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-900">Upstash (Redis)</th>
                                    <td className="px-6 py-3 text-gray-600">Temporary caching & response streaming.</td>
                                </tr>
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-900">Wikimedia Commons</th>
                                    <td className="px-6 py-3 text-gray-600">Public domain image search.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-sm text-gray-500 italic">
                        Note: We do not license your personal data to these providers for the purpose of training their general foundation models. Data is processed strictly to fulfill your generation requests.
                    </p>
                </section>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">4. User Rights</h2>
                    <p className="mb-4 text-gray-700">
                        Regardless of where you live, Currio respects your rights over your data:
                    </p>
                    <h3 className="text-lg font-bold mt-4 mb-2 text-[#1A1A1A]">Right to Access & Portability</h3>
                    <p className="text-gray-700 mb-4">You may view your profile and the courses you have created at any time via your Dashboard. You may request a copy of your data by contacting us.</p>

                    <h3 className="text-lg font-bold mt-4 mb-2 text-[#1A1A1A]">Right to Delete (&quot;Right to be Forgotten&quot;)</h3>
                    <p className="text-gray-700 mb-4">
                        You may request that we delete your account. 
                        <br/><br/>
                        <strong>Effect on Public Courses:</strong> Because Currio functions as a public library, if you delete your account, we may—at our discretion—either delete your courses entirely <em>OR</em> anonymize them (remove your name/ID) while keeping the educational content visible to the community.
                    </p>
                </section>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">5. Data Security & Storage</h2>
                    <p className="text-gray-700 mb-4">
                        We use <strong>Google Firebase</strong> infrastructure to store your data. This data is primarily stored on secure servers located in the <strong>United States</strong>.
                    </p>
                    <p className="text-gray-700 mb-4">
                        We implement standard security practices (HTTPS, secure database rules, API key restrictions). However, no system is impenetrable. You acknowledge that you provide your personal information at your own risk.
                    </p>
                </section>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">6. AI Disclaimer</h2>
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                        <p className="text-gray-700 mb-2">
                            Currio generates content using Large Language Models (LLMs). Please be aware:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700 text-sm">
                            <li><strong>Accuracy:</strong> AI can &quot;hallucinate&quot; or provide incorrect facts. Always verify critical information (medical, legal, historical) with primary sources.</li>
                            <li><strong>Bias:</strong> AI models may reflect biases present in their training data.</li>
                            <li><strong>Liability:</strong> Currio is a study aid, not an accredited educational institution. We are not liable for academic, professional, or personal consequences resulting from the use of generated materials.</li>
                            <li><strong>Automated Image Selection:</strong> Currio uses AI to automatically search and select images from Wikimedia Commons and other public domain sources to illustrate course content. While we make reasonable efforts to align images contextually with course topics, the automated selection process may occasionally display irrelevant, inappropriate, or unintended images. <strong>We do not manually review every image.</strong> Currio and its developers are not responsible for any offense, emotional distress, misrepresentation, or any other harm caused by automatically selected images. Users acknowledge that image selection is performed on a best-effort basis using automated systems and that results may vary in accuracy and appropriateness.</li>
                        </ul>
                    </div>
                </section>

                <hr className="my-8 border-gray-200" />

                <section>
                    <h2 className="text-2xl font-serif font-semibold mt-8 mb-4 text-[#1A1A1A]">7. Contact Us</h2>
                    <p className="text-gray-700 mb-4">
                        If you have questions about this Privacy Policy or wish to exercise your data rights, please contact the developer:
                    </p>
                    <div className="mt-4">
                        <p className="font-semibold text-gray-900">Nishant Das</p>
                        <a href="mailto:dasbudhe@gmail.com" className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                            dasbudhe@gmail.com
                        </a>
                    </div>
                </section>
                
                <div className="mt-12 pt-8 border-t border-gray-100 text-center text-gray-400 text-sm">
                    &copy; {new Date().getFullYear()} Currio. All rights reserved.
                </div>
            </article>
        </main>
    );
}