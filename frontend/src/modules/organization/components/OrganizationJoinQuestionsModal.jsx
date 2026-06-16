import { useEffect, useMemo } from "react";
import OrganizationJoinFormModal from "./OrganizationJoinFormModal";
import {
  getInitialJoinFormAnswer,
  getJoinFormAnswerIsMissing,
} from "./organizationJoinFormUtils";

const OrganizationJoinQuestionsModal = ({
  answers = {},
  isSubmitting = false,
  onChangeAnswer,
  onClose,
  onSubmit,
  open,
  preview,
}) => {
  const organization = preview?.organization;
  const questions = useMemo(
    () => preview?.joinQuestions || [],
    [preview?.joinQuestions],
  );
  const missingRequired = useMemo(
    () =>
      questions.some((question) =>
        getJoinFormAnswerIsMissing(question, answers),
      ),
    [answers, questions],
  );

  useEffect(() => {
    if (!open) return;

    questions.forEach((question) => {
      if (answers[question.id] === undefined) {
        onChangeAnswer?.(question.id, getInitialJoinFormAnswer(question));
      }
    });
  }, [answers, onChangeAnswer, open, questions]);

  return (
    <OrganizationJoinFormModal
      answers={answers}
      closeDisabled={isSubmitting}
      controlsDisabled={isSubmitting}
      isSubmitting={isSubmitting}
      joinMessage={preview?.joinMessage}
      onChangeAnswer={onChangeAnswer}
      onClose={onClose}
      onSubmit={onSubmit}
      open={Boolean(open && preview)}
      organization={organization}
      questions={questions}
      submitDisabled={missingRequired}
    />
  );
};

export default OrganizationJoinQuestionsModal;
