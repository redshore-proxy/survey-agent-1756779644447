import { MadeWithDyad } from "@/components/made-with-dyad";
import SurveyAssistant from "@/components/SurveyAssistant"; // Import the new component

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <h1 className="text-4xl font-bold mb-8">Welcome to Your Survey App</h1>
      <SurveyAssistant /> {/* Render the SurveyAssistant component */}
      <MadeWithDyad />
    </div>
  );
}
