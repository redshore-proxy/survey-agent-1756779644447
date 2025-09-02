"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  normalizeHeight,
  normalizeWeight,
  normalizeList,normalizeEnumMulti,
  normalizeCamFields,
  normalizeWearables,
  getNestedValue,
  setNestedValue,
} from "@/lib/survey-utils";

interface ChatMessage {
  type: 'user' | 'assistant';
  message: string;
}

interface SurveyQuestion {
  id: string;
  text: string;
  step: 'intro' | 'basic_profile' | 'medical_history' | 'medications_and_supplements' | 'miscellaneous';
  type: 'text' | 'number' | 'enum-single' | 'enum-multi' | 'list-free-text' | 'list-structured';
  enum?: string[];
  jsonPath: string; // Path in the final JSON object, e.g., "basic_profile.age"
  subQuestions?: {
    id: string;
    text: string;
    type: 'number' | 'text';
    jsonPath: string; // Path relative to the item in the list, e.g., "start_year"
  }[];
  normalizationRules?: string[]; // Custom rules to apply
}

interface SurveySchema {
  meta: {
    assistant_version: string;
    completed_at: string | null;
    progress: {
      total_questions: number;
      answered: number;
    };
  };
  basic_profile: {
    age: number | null;
    weight_pounds: number | null;
    height: string | null;
    height_inches_total: number | null;
    sex_assigned_at_birth: string | null;
    ancestries: { label: string; other_note: string | null }[];
  };
  medical_history: {
    conditions: { label: string; start_year: number | null; other_note: string | null }[];
    surgeries_or_hospital_stays: string[];
    allergies: { label: string; reaction: string | null; other_note: string | null }[];
  };
  medications_and_supplements: {
    medications: { name: string; dose_strength: string; frequency: string; purpose: string }[];
    supplements: { name: string; dose_strength: string; frequency: string; purpose: string }[];
  };  miscellaneous: {
    cam_fields: string[];
    wearable_devices: string[];
  };
}

const MEDICAL_CONDITIONS_ENUM = [
  "Anxiety disorder","Arthritis","Asthma","Bleeding disorder","Blood clots/DVT",
  "Cancer","Coronary artery disease","Claustrophobic","Diabetes (insulin)",
  "Diabetes (non-insulin)","Dialysis","Diverticulitis","Fibromyalgia","Gout",
  "Has pacemaker","Heart attack","Heart murmur","Hiatal hernia/reflux disease",
  "HIV/AIDS","High cholesterol","High blood pressure","Overactive thyroid",
  "Kidney disease","Kidney stones","Leg/foot ulcers","Liver disease","Osteoporosis",
  "Polio","Pulmonary embolism","Reflux/ulcers","Stroke","Tuberculosis",
  "Other","None"
];

const ANCESTRIES_ENUM = [
  "African-American","East Asian","Northern European/Caucasian",
  "Hispanic/Latino","Native American","Pacific Islander","South Asian",
  "Mediterranean","Middle Eastern","Ashkenazi Jewish","Other"
];

const ALLERGENS_ENUM = [
  "Artificial Colors & Dyes (FD&C Yellow No. 5)","Nuts","Dairy","Egg","Gluten",
  "Soy","Fish (e.g., Salmon, Tuna)","Shellfish (e.g., Shrimp, Crab, Lobster)",
  "Sesame","Corn","Gelatin","Other Allergens"
];const CAM_FIELDS_ENUM = [
  "Functional Medicine","Ayurveda","Traditional Chinese Medicine",
  "Homeopathy","Hanyak","All"
];

const WEARABLES_ENUM = [
  "OURA Ring","Apple Watch","Google Pixel Watch","Fitbit","None"
];

const questions: SurveyQuestion[] = [
  {
    id: 'intro',
    text: 'Hi, I’m your survey assistant. We’ll go through 12 quick questions (~3 minutes). No rush — your progress is saved automatically. Ready?',
    step: 'intro',
    type: 'text',
    jsonPath: '',  },
  {
    id: 'age',
    text: 'How old are you?',
    step: 'basic_profile',
    type: 'number',
    jsonPath: 'basic_profile.age',
  },
  {
    id: 'weight',
    text: 'What is your weight in pounds? (If in kg, please say so.)',
    step: 'basic_profile',type: 'text',
    jsonPath: 'basic_profile.weight_pounds',
    normalizationRules: ['weight'],
  },
  {
    id: 'height',
    text: 'What is your height? (Feet/inches or cm are fine.)',
    step: 'basic_profile',
    type: 'text',
    jsonPath: 'basic_profile.height',
    normalizationRules: ['height'],  },
  {
    id: 'sex_assigned_at_birth',
    text: 'What was your sex assigned at birth?',
    step: 'basic_profile',
    type: 'text',    jsonPath: 'basic_profile.sex_assigned_at_birth',
  },
  {
    id: 'ancestries',
    text: `Which ancestries apply to you? (Choose from the list: ${ANCESTRIES_ENUM.join(', ')}. If ‘Other’, please specify.)`,
    step: 'basic_profile',
    type: 'enum-multi',
    enum: ANCESTRIES_ENUM,jsonPath: 'basic_profile.ancestries',
    subQuestions: [
      {
        id: 'other_note',
        text: 'Please specify the other ancestry.',
        type: 'text',jsonPath: 'other_note',
      }
    ],
  },
  {
    id: 'conditions',
    text: `Please select any conditions from this list: ${MEDICAL_CONDITIONS_ENUM.join(', ')}. (If ‘Other’, specify. If ‘None’, choose only ‘None’.)`,
    step: 'medical_history',
    type: 'enum-multi',
    enum: MEDICAL_CONDITIONS_ENUM,
    jsonPath: 'medical_history.conditions',
    subQuestions: [
      {
        id: 'start_year',
        text: 'What is the start year (YYYY) for {condition}? If unknown, say ‘unknown’.',
        type: 'number',
        jsonPath: 'start_year',
      },
      {
        id: 'other_note',
        text: 'Please specify the other condition.',
        type: 'text',
        jsonPath: 'other_note',
      }
    ],
  },
  {
    id: 'surgeries_or_hospital_stays',
    text: 'Any surgeries or overnight hospital stays? (List as “procedure (year)”. Say “none” if none.)',
    step: 'medical_history',
    type: 'list-free-text',
    jsonPath: 'medical_history.surgeries_or_hospital_stays',
  },
  {
    id: 'allergies',
    text: `Do you have any allergies? (Choose from allergens list: ${ALLERGENS_ENUM.join(', ')}. For each, ask “What reaction do you have?” If “Other Allergens”, please specify allergen name(s). If “none”, record none.)`,step: 'medical_history',
    type: 'enum-multi',
    enum: ALLERGENS_ENUM,
    jsonPath: 'medical_history.allergies',
    subQuestions: [{
        id: 'reaction',
        text: 'What reaction do you have to {allergen}?',
        type: 'text',
        jsonPath: 'reaction',
      },
      {
        id: 'other_note',
        text: 'Please specify the other allergen(s).',
        type: 'text',
        jsonPath: 'other_note',
      }
    ],
  },{
    id: 'medications',
    text: 'Do you take any medications? (For each: Name, Dose/Strength, Frequency, Purpose. Say “none” if none.)',
    step: 'medications_and_supplements',
    type: 'list-structured',
    jsonPath: 'medications_and_supplements.medications',
    subQuestions: [
      { id: 'name', text: 'Name:', type: 'text', jsonPath: 'name' },
      { id: 'dose_strength', text: 'Dose/Strength:', type: 'text', jsonPath: 'dose_strength' },
      { id: 'frequency', text: 'Frequency:', type: 'text', jsonPath: 'frequency' },
      { id: 'purpose', text: 'Purpose:', type: 'text', jsonPath: 'purpose' },
    ],
  },
  {
    id: 'supplements',
    text: 'Do you take any supplements? (For each: Name, Dose/Strength, Frequency, Purpose. Say “none” if none.)',
    step: 'medications_and_supplements',
    type: 'list-structured',
    jsonPath: 'medications_and_supplements.supplements',
    subQuestions: [{ id: 'name', text: 'Name:', type: 'text', jsonPath: 'name' },
      { id: 'dose_strength', text: 'Dose/Strength:', type: 'text', jsonPath: 'dose_strength' },
      { id: 'frequency', text: 'Frequency:', type: 'text', jsonPath: 'frequency' },
      { id: 'purpose', text: 'Purpose:', type: 'text', jsonPath: 'purpose' },
    ],
  },
  {
    id: 'cam_fields',
    text: `Which complementary & alternative medicine (CAM) fields do you prefer? (Options: ${CAM_FIELDS_ENUM.join(', ')}. “All” expands.)`,
    step: 'miscellaneous',
    type: 'enum-multi',
    enum: CAM_FIELDS_ENUM,
    jsonPath: 'miscellaneous.cam_fields',
  },
  {
    id: 'wearable_devices',
    text: `Do you use any of these wearable devices? (${WEARABLES_ENUM.join(', ')}.)`,
    step: 'miscellaneous',
    type: 'enum-multi',
    enum: WEARABLES_ENUM,
    jsonPath: 'miscellaneous.wearable_devices',
  },
];

const initialSurveyData: SurveySchema = {
  meta: {
    assistant_version: "v1",
    completed_at: null,
    progress: {
      total_questions: questions.filter(q => q.id !== 'intro').length,
      answered: 0,
    },
  },
  basic_profile: {
    age: null,
    weight_pounds: null,
    height: null,
    height_inches_total: null,
    sex_assigned_at_birth: null,
    ancestries: [],
  },
  medical_history: {
    conditions: [],surgeries_or_hospital_stays: [],
    allergies: [],
  },
  medications_and_supplements: {
    medications: [],
    supplements: [],
  },
  miscellaneous: {
    cam_fields: [],
    wearable_devices: [],
  },
};

const SurveyAssistant: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [surveyData, setSurveyData] = useState<SurveySchema>(initialSurveyData);
  const [userInput, setUserInput] = useState('');
  const [isSurveyFinished, setIsSurveyFinished] = useState(false);
  const [outputJson, setOutputJson] = useState<string | null>(null);

  // State for handling sub-questions (e.g., start year for conditions, reaction for allergies)
  const [pendingSubQuestions, setPendingSubQuestions] = useState<{
    mainQuestionId: string;
    item: any; // The item in the list (e.g., { label: "Cancer", start_year: null })
    subQuestionIndex: number; // Index of the sub-question to ask for this item
    originalInput?: string; // Original user input for the main question
  }[]>([]);

  // State for handling structured lists (medications/supplements)
  const [isCollectingStructuredListItem, setIsCollectingStructuredListItem] = useState(false);
  const [currentStructuredListItem, setCurrentStructuredListItem] = useState<any | null>(null);
  const [currentStructuredListSubQuestionIndex, setCurrentStructuredListSubQuestionIndex] = useState(0);
  const [structuredListItemsCollected, setStructuredListItemsCollected] = useState<any[]>([]);
  const [structuredListMainQuestionId, setStructuredListMainQuestionId] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    // Initial greeting
    if (chatHistory.length === 0) {
      addAssistantMessage(questions[0].text);
    }
  }, []);

  const addAssistantMessage = (message: string) => {
    setChatHistory(prev => [...prev, { type: 'assistant', message }]);
  };

  const addUserMessage = (message: string) => {
    setChatHistory(prev => [...prev, { type: 'user', message }]);
  };

  const askCurrentQuestion = () => {
    if (currentQuestionIndex < questions.length) {
      const currentQ = questions[currentQuestionIndex];
      addAssistantMessage(currentQ.text);
    }
  };

  const askNextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
    // If we've moved past the intro, increment answered count for main questions
    if (questions[currentQuestionIndex].id !== 'intro') {
      setSurveyData(prev => ({
        ...prev,
        meta: {
          ...prev.meta,
          progress: {
            ...prev.meta.progress,
            answered: prev.meta.progress.answered + 1,
          },
        },
      }));
    }
  };

  useEffect(() => {    if (isSurveyFinished) return;

    if (outputJson) {
      // If JSON is already output, don't ask more questions
      return;
    }

    if (pendingSubQuestions.length > 0) {
      const { mainQuestionId, item, subQuestionIndex } = pendingSubQuestions[0];
      const mainQ = questions.find(q => q.id === mainQuestionId);
      if (mainQ && mainQ.subQuestions && mainQ.subQuestions[subQuestionIndex]) {
        const subQ = mainQ.subQuestions[subQuestionIndex];
        let subQText = subQ.text;
        if (item.label) {
          subQText = subQText.replace('{condition}', item.label).replace('{allergen}', item.label);
        }
        addAssistantMessage(subQText);
      }
      return;
    }

    if (isCollectingStructuredListItem && structuredListMainQuestionId) {
      const mainQ = questions.find(q => q.id === structuredListMainQuestionId);
      if (mainQ && mainQ.subQuestions && mainQ.subQuestions[currentStructuredListSubQuestionIndex]) {
        const subQ = mainQ.subQuestions[currentStructuredListSubQuestionIndex];
        addAssistantMessage(`${subQ.text}`);
      }
      return;
    }

    if (currentQuestionIndex < questions.length) {
      askCurrentQuestion();
    } else {
      completeSurvey();
    }
  }, [currentQuestionIndex, pendingSubQuestions, isCollectingStructuredListItem, outputJson, isSurveyFinished]);

  const completeSurvey = () => {
    setIsSurveyFinished(true);
    setSurveyData(prev => ({...prev,
      meta: {
        ...prev.meta,
        completed_at: new Date().toISOString(),
      },
    }));
    setOutputJson(JSON.stringify(surveyData, null, 2));  };

  const handleStructuredListItemInput = (value: string) => {
    if (!structuredListMainQuestionId) return;

    const mainQ = questions.find(q => q.id === structuredListMainQuestionId);
    if (!mainQ || !mainQ.subQuestions) return;

    const subQ = mainQ.subQuestions[currentStructuredListSubQuestionIndex];
    const newItem = { ...currentStructuredListItem, [subQ.jsonPath]: value };
    setCurrentStructuredListItem(newItem);

    if (currentStructuredListSubQuestionIndex < mainQ.subQuestions.length - 1) {
      setCurrentStructuredListSubQuestionIndex(prev => prev + 1);
    } else {
      // All sub-questions for this item are answered
      setStructuredListItemsCollected(prev => [...prev, newItem]);
      setCurrentStructuredListItem({}); // Reset for next item
      setCurrentStructuredListSubQuestionIndex(0); // Reset sub-question index
      addAssistantMessage('Any more items? (yes/no)');
    }
  };

  const handleStructuredListMoreItems = (value: string) => {
    if (value.toLowerCase() === 'yes') {
      addAssistantMessage('Okay, let\'s add another item.');
      setIsCollectingStructuredListItem(true); // Continue collecting
      // The useEffect will trigger the first sub-question for the new item
    } else {
      // No more items, save collected items and move to next main question
      const path = questions.find(q => q.id === structuredListMainQuestionId)?.jsonPath;
      if (path) {
        setSurveyData(prev => setNestedValue({ ...prev }, path, structuredListItemsCollected));
      }
      setStructuredListItemsCollected([]);
      setCurrentStructuredListItem(null);
      setIsCollectingStructuredListItem(false);
      setStructuredListMainQuestionId(null);
      askNextQuestion();
    }
  };

  const handleSubQuestionInput = (value: string) => {
    if (pendingSubQuestions.length === 0) return;

    const currentPending = pendingSubQuestions[0];
    const { mainQuestionId, item, subQuestionIndex } = currentPending;
    const mainQ = questions.find(q => q.id === mainQuestionId);

    if (!mainQ || !mainQ.subQuestions || !mainQ.subQuestions[subQuestionIndex]) {
      console.error("Invalid sub-question context.");
      setPendingSubQuestions(prev => prev.slice(1)); // Skip this one
      return;
    }

    const subQ = mainQ.subQuestions[subQuestionIndex];
    let processedValue: any = value;

    if (value.toLowerCase() === 'unknown' || value.toLowerCase() === 'skip' || value.toLowerCase() === 'none' || value.toLowerCase() === 'not sure' || value === '') {
      processedValue = null;
    } else if (subQ.type === 'number') {
      const num = parseInt(value, 10);
      processedValue = isNaN(num) ? null : num;
    }

    // Update the item with the sub-question answer
    const updatedItem = { ...item, [subQ.jsonPath]: processedValue };

    // Find the original list in surveyData and update it
    setSurveyData(prev => {
      const newSurveyData = { ...prev };
      const listPath = mainQ.jsonPath;
      const currentList = getNestedValue(newSurveyData, listPath) as any[];
      const itemIndex = currentList.findIndex(i => i.label === item.label);
      if (itemIndex !== -1) {
        currentList[itemIndex] = updatedItem;
        setNestedValue(newSurveyData, listPath, currentList);
      }
      return newSurveyData;
    });

    // Move to the next sub-question for this item, or next item, or next main question
    const nextSubQuestionIndex = subQuestionIndex + 1;
    if (nextSubQuestionIndex < mainQ.subQuestions.length) {
      // Still more sub-questions for the current item
      setPendingSubQuestions(prev => [
        { ...currentPending, subQuestionIndex: nextSubQuestionIndex, item: updatedItem },
        ...prev.slice(1),
      ]);
    } else {
      // No more sub-questions for this item, move to the next pending item or next main question
      setPendingSubQuestions(prev => prev.slice(1));
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const value = userInput.trim();
    if (!value) return;

    addUserMessage(value);
    setUserInput('');

    const lowerValue = value.toLowerCase();
    if (['done', 'finish', 'stop'].includes(lowerValue)) {
      completeSurvey();
      return;
    }

    if (outputJson) {
      // If JSON is already output, don't process further input
      return;
    }

    if (pendingSubQuestions.length > 0) {
      handleSubQuestionInput(value);
      return;
    }

    if (isCollectingStructuredListItem && structuredListMainQuestionId) {
      const mainQ = questions.find(q => q.id === structuredListMainQuestionId);
      if (mainQ && mainQ.subQuestions && currentStructuredListSubQuestionIndex < mainQ.subQuestions.length) {
        handleStructuredListItemInput(value);
      } else {
        // This means we are asking "Any more items?"
        handleStructuredListMoreItems(value);
      }
      return;
    }

    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) {
      completeSurvey();
      return;
    }

    let processedValue: any = value;
    let shouldAskNext = true;
    let newPendingSubQuestions: typeof pendingSubQuestions = [];

    // Apply normalization rules and update surveyData
    setSurveyData(prev => {
      const newSurveyData = { ...prev };
      const path = currentQ.jsonPath;

      if (currentQ.id === 'intro') {
        // No data to save for intro, just move to next question} else if (currentQ.normalizationRules?.includes('weight')) {
        processedValue = normalizeWeight(value);
        setNestedValue(newSurveyData, path, processedValue);
      } else if (currentQ.normalizationRules?.includes('height')) {
        const { height, height_inches_total } = normalizeHeight(value);
        setNestedValue(newSurveyData, 'basic_profile.height', height);
        setNestedValue(newSurveyData, 'basic_profile.height_inches_total', height_inches_total);
      } else if (currentQ.type === 'number') {
        const num = parseInt(value, 10);
        processedValue = isNaN(num) || value.toLowerCase() === 'skip' || value.toLowerCase() === 'none' || value.toLowerCase() === 'not sure' ? null : num;
        setNestedValue(newSurveyData, path, processedValue);
      } else if (currentQ.type === 'enum-multi') {
        let normalizedItems: { label: string; other_note: string | null }[] | string[] = [];
        if (currentQ.id === 'cam_fields') {
          normalizedItems = normalizeCamFields(value, currentQ.enum || []);
        } else if (currentQ.id === 'wearable_devices') {
          normalizedItems = normalizeWearables(value, currentQ.enum || []);
        } else {
          normalizedItems = normalizeEnumMulti(value, currentQ.enum || [], currentQ.id === 'allergies' ? 'Other Allergens' : 'Other', 'None');
        }

        setNestedValue(newSurveyData, path, normalizedItems);

        // Handle sub-questions for enum-multi (e.g., conditions, ancestries, allergies)
        if (currentQ.subQuestions && Array.isArray(normalizedItems)) {
          normalizedItems.forEach(item => {
            if (typeof item === 'object' && item !== null) { // Ensure it's an object like {label, other_note}
              if (item.label === 'Other' || item.label === 'Other Allergens') {
                const otherNoteSubQ = currentQ.subQuestions?.find(sq => sq.id === 'other_note');
                if (otherNoteSubQ && !item.other_note) { // Only ask if other_note is not already provided by user
                  newPendingSubQuestions.push({
                    mainQuestionId: currentQ.id,
                    item: item,
                    subQuestionIndex: currentQ.subQuestions.findIndex(sq => sq.id === 'other_note'),
                    originalInput: value,
                  });
                }
              } else if (currentQ.id === 'conditions' && item.label !== 'None') {
                const startYearSubQ = currentQ.subQuestions?.find(sq => sq.id === 'start_year');
                if (startYearSubQ) {
                  newPendingSubQuestions.push({
                    mainQuestionId: currentQ.id,
                    item: item,
                    subQuestionIndex: currentQ.subQuestions.findIndex(sq => sq.id === 'start_year'),
                    originalInput: value,
                  });
                }
              } else if (currentQ.id === 'allergies' && item.label !== 'None') {
                const reactionSubQ = currentQ.subQuestions?.find(sq => sq.id === 'reaction');
                if (reactionSubQ) {
                  newPendingSubQuestions.push({
                    mainQuestionId: currentQ.id,
                    item: item,
                    subQuestionIndex: currentQ.subQuestions.findIndex(sq => sq.id === 'reaction'),
                    originalInput: value,
                  });
                }
              }
            }
          });
        }
        setPendingSubQuestions(newPendingSubQuestions);
        if (newPendingSubQuestions.length > 0) {
          shouldAskNext = false; // Don't ask next main question yet, process sub-questions
        }
      } else if (currentQ.type === 'list-free-text') {
        const list = normalizeList(value);
        setNestedValue(newSurveyData, path, list.length === 0 ? [] : list);
      } else if (currentQ.type === 'list-structured') {
        if (value.toLowerCase() === 'none' || value.toLowerCase() === 'skip' || value.toLowerCase() === 'not sure') {
          setNestedValue(newSurveyData, path, []);
        } else {
          // Start collecting structured list items
          setIsCollectingStructuredListItem(true);
          setStructuredListMainQuestionId(currentQ.id);
          setCurrentStructuredListItem({});
          setCurrentStructuredListSubQuestionIndex(0);
          shouldAskNext = false; // Don't ask next main question yet
        }
      } else {
        // Default for 'text' or 'enum-single'
        processedValue = value.toLowerCase() === 'skip' || value.toLowerCase() === 'none' || value.toLowerCase() === 'not sure' ? null : value;
        setNestedValue(newSurveyData, path, processedValue);
      }
      return newSurveyData;    });

    if (shouldAskNext) {
      askNextQuestion();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto my-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">Survey Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-[600px]">
        <ScrollArea className="flex-1 p-4 border rounded-md mb-4 bg-gray-50 dark:bg-gray-800" ref={scrollAreaRef}>
          <div className="flex flex-col space-y-4">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    msg.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            {outputJson && (
              <div className="flex justify-center">
                <pre className="max-w-full p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg overflow-auto text-sm">
                  {outputJson}
                </pre>
              </div>
            )}
          </div>
        </ScrollArea>

        {!isSurveyFinished && (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your answer here..."
              className="flex-1"
              disabled={isSurveyFinished}
            />
            <Button type="submit" disabled={isSurveyFinished}>Send</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default SurveyAssistant;
