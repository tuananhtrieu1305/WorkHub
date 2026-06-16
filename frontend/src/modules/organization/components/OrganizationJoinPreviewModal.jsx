import { useMemo, useState } from "react";
import OrganizationJoinFormModal from "./OrganizationJoinFormModal";

const OrganizationJoinPreviewModal = ({
  accentColor,
  joinMessage,
  onClose,
  open,
  organization,
  questions = [],
}) => {
  const [previewAnswers, setPreviewAnswers] = useState({});
  const previewOrganization = useMemo(
    () => ({
      ...(organization || {}),
      accentColor: accentColor || organization?.accentColor,
    }),
    [accentColor, organization],
  );

  const closePreview = () => {
    setPreviewAnswers({});
    onClose?.();
  };

  const updatePreviewAnswer = (questionId, value) => {
    setPreviewAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: value,
    }));
  };

  return (
    <OrganizationJoinFormModal
      answers={previewAnswers}
      joinMessage={joinMessage}
      onChangeAnswer={updatePreviewAnswer}
      onClose={closePreview}
      open={open}
      organization={previewOrganization}
      questions={questions}
      submitDisabled
    />
  );
};

export default OrganizationJoinPreviewModal;
