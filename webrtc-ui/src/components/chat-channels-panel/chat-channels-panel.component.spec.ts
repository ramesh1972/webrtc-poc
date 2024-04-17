import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatChannelsPanelComponent } from './chat-channels-panel.component';

describe('ChatChannelsPanelComponent', () => {
  let component: ChatChannelsPanelComponent;
  let fixture: ComponentFixture<ChatChannelsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatChannelsPanelComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChatChannelsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
