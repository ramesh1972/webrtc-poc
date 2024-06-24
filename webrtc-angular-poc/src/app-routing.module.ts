import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatMainViewComponent } from './views/chat-main-view/chat-main-view.component';

const routes: Routes = [
  { path: '', component: ChatMainViewComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }