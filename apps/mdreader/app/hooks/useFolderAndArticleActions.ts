import { useToast } from '@mdreader/interface';
import { File, Folder } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

import { articleSchema, folderSchema } from '~/schema';
import { articleService } from '~/services/article';
import { folderService } from '~/services/folder';
import useSupabase from './useSupabase';

type Props = {
  articles: any[];
  folders: any[];
  mutateArticles: any;
  mutateFolders: any;
  canModify: boolean;
};

type ConfirmDialogState = {
  open: boolean;
  onConfirm: () => void;
};

type ArticleForm = z.infer<typeof articleSchema>;
type FolderForm = z.infer<typeof folderSchema>;

const getDescriptionMessage = (
  text: string
) => `This action cannot be undone. This will permanently delete your
"${text}".`;

const useFolderAndArticleActions = ({
  articles,
  folders,
  mutateArticles,
  mutateFolders,
  canModify,
}: Props) => {
  const client = useSupabase();
  const _articleService = useMemo(() => articleService(client), [client]);
  const _folderService = useMemo(() => folderService(client), [client]);

  const { toast } = useToast();

  const [confirmDialogProps, setConfirmDialogProps] =
    useState<ConfirmDialogState>({
      open: false,
      onConfirm: () => undefined,
    });

  const [panelProps, setPanelProps] = useState({ defaultValues: {} });

  const setOpen = useCallback(
    (open: boolean) => {
      setPanelProps((prevState) => ({
        ...prevState,
        defaultValues: {},
        defaultPanel: null,
        open,
      }));
    },
    [setPanelProps]
  );

  const onSave = useCallback(
    (type: 'article' | 'folder') => {
      const properties = {
        mutate: type === 'article' ? mutateArticles : mutateFolders,
        service: type === 'article' ? _articleService : _folderService,
      };

      return async (form: ArticleForm | FolderForm) => {
        const { error, data } = await properties.service.store(form as any);

        if (error) {
          console.error(error);

          return toast({
            description: 'There was a problem with your request.',
            title: 'Uh oh! Something went wrong.',
            variant: 'destructive',
          });
        }

        properties.mutate((prevRows: any[]) => {
          if (form.id) {
            return prevRows?.map((prevRow) => {
              if (prevRow.id === form.id) {
                return form;
              }

              return prevRow;
            });
          }

          return [
            ...(prevRows as any),
            { ...form, id: data[0]?.id ?? new Date().getTime() },
          ];
        });

        toast({
          description: `"${form.name}" ${type} was saved to your list :)`,
          title: 'Success',
        });

        setOpen(false);
      };
    },
    [_articleService, _folderService, setOpen]
  );

  const onDelete = useCallback((record: any, mutate: any) => {
    mutate((prevRecords: any[]) =>
      prevRecords
        ? prevRecords?.filter((prevRecord) => prevRecord.id !== record.id)
        : []
    );

    toast({ title: 'Success' });
  }, []);

  const items = useMemo(() => {
    const _articles = articles.map((article) => ({
      ...article,
      actions: canModify
        ? [
            {
              name: 'Edit',
              onClick: () =>
                setPanelProps((panelProps) => ({
                  ...panelProps,
                  defaultPanel: 'article',
                  defaultValues: article,
                  open: true,
                })),
            },
            {
              name: 'Remove',
              onClick: async () =>
                setConfirmDialogProps((prevState) => ({
                  ...prevState,
                  description: getDescriptionMessage(article.name),
                  onConfirm: () =>
                    _articleService
                      .remove(article.id)
                      .then(() => onDelete(article, mutateArticles)),
                  open: true,
                })),
            },
          ]
        : null,
      href: `preview/${article.id}-${article.slug}`,
      Icon: File,
    }));

    const _folders = folders.map((folder) => ({
      ...folder,
      actions: canModify
        ? [
            {
              name: 'Edit',
              onClick: () =>
                setPanelProps((panelProps) => ({
                  ...panelProps,
                  defaultValues: folder,
                  defaultPanel: 'folder',
                  open: true,
                })),
            },
            {
              name: 'Remove',
              onClick: async () =>
                setConfirmDialogProps((prevState) => ({
                  ...prevState,
                  description: getDescriptionMessage(folder.name),
                  open: true,
                  onConfirm: () =>
                    _folderService
                      .remove(folder.id)
                      .then(() => onDelete(folder, mutateFolders)),
                })),
            },
          ]
        : null,
      href: `?folderId=${folder.id}`,
      Icon: Folder,
    }));

    return [..._folders, ..._articles];
  }, [
    _articleService,
    _folderService,
    articles,
    folders,
    canModify,
    onDelete,
    setConfirmDialogProps,
    setPanelProps,
  ]);

  return {
    confirmDialogProps: {
      ...confirmDialogProps,
      onCancel: () =>
        setConfirmDialogProps((prevProps) => ({ ...prevProps, open: false })),
    },
    items,
    panelProps: {
      ...panelProps,
      onSave,
      setOpen,
    },
  };
};

export type OnSaveArticleAndFolder = ReturnType<
  typeof useFolderAndArticleActions
>['panelProps']['onSave'];

export default useFolderAndArticleActions;
