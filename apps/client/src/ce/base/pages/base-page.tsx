import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Center, Loader } from "@mantine/core";
import { IconFileOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { usePageQuery } from "@/features/page/queries/page-query";
import { buildPageUrl } from "@/features/page/page.utils";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * `/base/:pageId` is an id-based deep link. A base is a page, and
 * pages/page/page.tsx already renders bases, so resolve the page and
 * forward to its canonical URL.
 */
export default function BasePage() {
  const { t } = useTranslation();
  const { pageId } = useParams();
  const navigate = useNavigate();
  const { data: page, isLoading, isError } = usePageQuery({ pageId });

  useEffect(() => {
    if (!page) return;
    navigate(buildPageUrl(page.space?.slug, page.slugId, page.title), { replace: true });
  }, [page, navigate]);

  if (isLoading || (page && !isError)) {
    return (
      <Center h="60vh">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <EmptyState
      icon={IconFileOff}
      title={t("Page not found")}
      description={t("This page may have been deleted, moved, or you may not have access.")}
      action={
        <Button component={Link} to="/home" variant="default" size="sm" mt="xs">
          {t("Go to homepage")}
        </Button>
      }
    />
  );
}
