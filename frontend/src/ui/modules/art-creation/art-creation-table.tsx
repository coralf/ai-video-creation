import './style.css';

import { Table } from 'antd';
import { observer } from 'mobx-react';

import { DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { EditableCell } from './edit-table-cell';
import { EditableRow } from './edit-table-row';
import { useArtCreationController, useTableColumns } from './hooks';

import type { DragEndEvent } from '@dnd-kit/core';
import { log } from 'console';
export const TableFooter = observer(() => {
  const controller = useArtCreationController();
  return <div>
    分镜总数：{controller.store?.editTableDataSource?.length || 0}
  </div>
})


export const ArtCreationTable = observer(() => {
  const controller = useArtCreationController();
  const columns = useTableColumns();

  const handleDragEnd = (options: DragEndEvent) => {
    controller.handleDragEnd(options);
  };

  const windowHeight = window.innerHeight
  let scrollHeight;
  if (windowHeight >= 1200) {
    scrollHeight = '80vh';
  } else if (windowHeight > 900) {
    scrollHeight = '70vh';
  } else if (windowHeight > 500) {
    scrollHeight = '55vh'; // 默认值
  }


  return (
    <div className="table-layout">
      <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        <SortableContext
          items={controller.store.editTableDataSource.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <Table
            footer={() => <TableFooter />}
            rowKey={'id'}
            scroll={{ y: scrollHeight }}
            components={{
              body: {
                cell: EditableCell,
                row: EditableRow
              },
            }}
            bordered={false}
            dataSource={controller.store.editTableDataSource}
            columns={columns}
            rowClassName="editable-row"
            pagination={false}
          />
        </SortableContext>
      </DndContext>
    </div>
  );
});

