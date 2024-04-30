// app.module.ts
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { CommonModule } from '@angular/common'; // Import CommonModule

import { AppComponent } from './app.component';
import { TextChatComponent } from './text-chat/text-chat.component';

//import { ChatModule } from './chat/xchat.module'; // Import ChatModule

@NgModule({
  declarations: [
    AppComponent,
    TextChatComponent
  ],
  imports: [
    BrowserModule,
    CommonModule, // Add CommonModule to the imports array
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule  { }